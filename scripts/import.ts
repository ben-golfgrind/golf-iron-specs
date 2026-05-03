// CSV import pipeline.
//
// Reads three CSVs from data/ and pushes them into Postgres via Prisma:
//   data/manufacturers.csv     -> manufacturers table
//   data/iron-sets.csv         -> iron_sets table       (FK to manufacturers via slug)
//   data/iron-set-specs.csv    -> iron_set_specs table  (FK to iron_sets via mfr+model+year)
//
// Behavior:
//   - Validates everything before touching the DB. Any error aborts the run.
//   - Upsert-by-natural-key with explicit create/update/unchanged classification,
//     so re-running is a true no-op when nothing has changed.
//   - Additive only: rows removed from a CSV are NOT deleted from the DB.
//   - If data/ doesn't exist or all CSVs are empty, exits cleanly with a hint.
//
// Usage:
//   npm run db:import

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";

// ---- Constants ----------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");
const MANUFACTURERS_CSV = path.join(DATA_DIR, "manufacturers.csv");
const IRON_SETS_CSV = path.join(DATA_DIR, "iron-sets.csv");
const IRON_SET_SPECS_CSV = path.join(DATA_DIR, "iron-set-specs.csv");

const VALID_CLUBS = new Set([
  "1i", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i",
  "PW", "GW", "AW", "SW", "LW",
]);

// Sanity bounds. Out-of-range values are loud errors -- they almost always
// indicate a transcription mistake (decimal point in the wrong place, swapped
// loft/lie columns, etc.).
const RANGES = {
  releaseYear: { min: 1980, max: 2030 },
  loftDeg: { min: 15, max: 65 },
  lieDeg: { min: 55, max: 70 },
  offsetMm: { min: -2, max: 10 },
  lengthIn: { min: 33, max: 42 },
};

// ---- Parsed row types ---------------------------------------------------

type ManufacturerRow = { name: string; slug: string };
type IronSetRow = {
  manufacturer_slug: string;
  model_name: string;
  release_year: number;
  source_url: string;
  notes: string | null;
};
type IronSetSpecRow = {
  manufacturer_slug: string;
  model_name: string;
  release_year: number;
  club: string;
  loft_deg: number | null;
  lie_deg: number | null;
  offset_mm: number | null;
  length_in: number | null;
};

type Counts = { created: number; updated: number; unchanged: number };

// ---- Entry point --------------------------------------------------------

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(
      `No data/ directory found at ${DATA_DIR}. Create it with manufacturers.csv, iron-sets.csv, iron-set-specs.csv. See README.`,
    );
    return;
  }

  const mfrs = readCsv<ManufacturerRow>(MANUFACTURERS_CSV, parseManufacturer);
  const sets = readCsv<IronSetRow>(IRON_SETS_CSV, parseIronSet);
  const specs = readCsv<IronSetSpecRow>(IRON_SET_SPECS_CSV, parseIronSetSpec);

  if (mfrs.length === 0 && sets.length === 0 && specs.length === 0) {
    console.log("All three CSVs are empty. Nothing to import.");
    return;
  }

  validateCrossFileRefs(mfrs, sets, specs);

  const mfrCounts = await syncManufacturers(mfrs);
  const setCounts = await syncIronSets(sets);
  const specCounts = await syncIronSetSpecs(specs);

  printSummary("manufacturers  ", mfrCounts);
  printSummary("iron_sets      ", setCounts);
  printSummary("iron_set_specs ", specCounts);
}

main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });

// ---- CSV parsing --------------------------------------------------------

function readCsv<T>(filePath: string, parseRow: (raw: Record<string, string>, lineNum: number) => T): T[] {
  if (!fs.existsSync(filePath)) return [];
  const contents = fs.readFileSync(filePath, "utf8").trim();
  if (contents.length === 0) return [];

  let records: Record<string, string>[];
  try {
    records = parse(contents, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw fail(`${path.basename(filePath)}: failed to parse CSV (${err instanceof Error ? err.message : err})`);
  }

  return records.map((raw, i) => parseRow(raw, i + 2));
}

function parseManufacturer(raw: Record<string, string>, lineNum: number): ManufacturerRow {
  const name = required(raw.name, "manufacturers.csv", lineNum, "name");
  const slug = required(raw.slug, "manufacturers.csv", lineNum, "slug");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw fail(`manufacturers.csv line ${lineNum}: slug must be lowercase letters, digits, and hyphens (got "${slug}")`);
  }
  return { name, slug };
}

function parseIronSet(raw: Record<string, string>, lineNum: number): IronSetRow {
  const manufacturer_slug = required(raw.manufacturer_slug, "iron-sets.csv", lineNum, "manufacturer_slug");
  const model_name = required(raw.model_name, "iron-sets.csv", lineNum, "model_name");
  const release_year = parseIntInRange(
    raw.release_year, "iron-sets.csv", lineNum, "release_year", RANGES.releaseYear,
  );
  const source_url = required(raw.source_url, "iron-sets.csv", lineNum, "source_url");
  if (!/^https?:\/\//i.test(source_url)) {
    throw fail(`iron-sets.csv line ${lineNum}: source_url must start with http:// or https:// (got "${source_url}")`);
  }
  return {
    manufacturer_slug,
    model_name,
    release_year,
    source_url,
    notes: emptyToNull(raw.notes),
  };
}

function parseIronSetSpec(raw: Record<string, string>, lineNum: number): IronSetSpecRow {
  const manufacturer_slug = required(raw.manufacturer_slug, "iron-set-specs.csv", lineNum, "manufacturer_slug");
  const model_name = required(raw.model_name, "iron-set-specs.csv", lineNum, "model_name");
  const release_year = parseIntInRange(
    raw.release_year, "iron-set-specs.csv", lineNum, "release_year", RANGES.releaseYear,
  );
  const club = required(raw.club, "iron-set-specs.csv", lineNum, "club");
  if (!VALID_CLUBS.has(club)) {
    throw fail(
      `iron-set-specs.csv line ${lineNum}: club must be one of ${[...VALID_CLUBS].join(", ")} (got "${club}")`,
    );
  }
  return {
    manufacturer_slug,
    model_name,
    release_year,
    club,
    loft_deg: parseFloatInRange(raw.loft_deg, "iron-set-specs.csv", lineNum, "loft_deg", RANGES.loftDeg),
    lie_deg: parseFloatInRange(raw.lie_deg, "iron-set-specs.csv", lineNum, "lie_deg", RANGES.lieDeg),
    offset_mm: parseFloatInRange(raw.offset_mm, "iron-set-specs.csv", lineNum, "offset_mm", RANGES.offsetMm),
    length_in: parseFloatInRange(raw.length_in, "iron-set-specs.csv", lineNum, "length_in", RANGES.lengthIn),
  };
}

// ---- Cross-file validation ---------------------------------------------

function validateCrossFileRefs(
  mfrs: ManufacturerRow[],
  sets: IronSetRow[],
  specs: IronSetSpecRow[],
) {
  // Within-file dupes.
  assertUnique(mfrs.map((m) => m.slug), "manufacturers.csv", "slug");
  assertUnique(mfrs.map((m) => m.name), "manufacturers.csv", "name");
  assertUnique(
    sets.map((s) => `${s.manufacturer_slug}|${s.model_name}|${s.release_year}`),
    "iron-sets.csv",
    "(manufacturer_slug, model_name, release_year)",
  );
  assertUnique(
    specs.map((s) => `${s.manufacturer_slug}|${s.model_name}|${s.release_year}|${s.club}`),
    "iron-set-specs.csv",
    "(manufacturer_slug, model_name, release_year, club)",
  );

  // Cross-file FKs.
  const mfrSlugs = new Set(mfrs.map((m) => m.slug));
  for (const s of sets) {
    if (!mfrSlugs.has(s.manufacturer_slug)) {
      throw fail(
        `iron-sets.csv references manufacturer_slug "${s.manufacturer_slug}" but it's not in manufacturers.csv`,
      );
    }
  }
  const setKeys = new Set(
    sets.map((s) => `${s.manufacturer_slug}|${s.model_name}|${s.release_year}`),
  );
  for (const sp of specs) {
    const k = `${sp.manufacturer_slug}|${sp.model_name}|${sp.release_year}`;
    if (!setKeys.has(k)) {
      throw fail(
        `iron-set-specs.csv references "${k.replace(/\|/g, " ")}" but no such row exists in iron-sets.csv`,
      );
    }
  }
}

// ---- DB sync ------------------------------------------------------------

async function syncManufacturers(rows: ManufacturerRow[]): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, unchanged: 0 };
  for (const row of rows) {
    const existing = await db.manufacturer.findUnique({ where: { slug: row.slug } });
    if (!existing) {
      await db.manufacturer.create({ data: { name: row.name, slug: row.slug } });
      counts.created++;
    } else if (existing.name !== row.name) {
      await db.manufacturer.update({ where: { slug: row.slug }, data: { name: row.name } });
      counts.updated++;
    } else {
      counts.unchanged++;
    }
  }
  return counts;
}

async function syncIronSets(rows: IronSetRow[]): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, unchanged: 0 };
  // Resolve manufacturer slug -> id map up front (one query).
  const mfrMap = new Map<string, number>();
  for (const m of await db.manufacturer.findMany({ select: { id: true, slug: true } })) {
    mfrMap.set(m.slug, m.id);
  }

  for (const row of rows) {
    const manufacturerId = mfrMap.get(row.manufacturer_slug);
    if (!manufacturerId) {
      throw fail(
        `iron-sets.csv: manufacturer "${row.manufacturer_slug}" should have been upserted by now (internal error)`,
      );
    }

    const existing = await db.ironSet.findUnique({
      where: {
        iron_sets_mfr_model_year_unique: {
          manufacturerId,
          modelName: row.model_name,
          releaseYear: row.release_year,
        },
      },
    });

    if (!existing) {
      await db.ironSet.create({
        data: {
          manufacturerId,
          modelName: row.model_name,
          releaseYear: row.release_year,
          sourceUrl: row.source_url,
          notes: row.notes,
        },
      });
      counts.created++;
      continue;
    }

    const changed = existing.sourceUrl !== row.source_url || existing.notes !== row.notes;
    if (changed) {
      await db.ironSet.update({
        where: { id: existing.id },
        data: { sourceUrl: row.source_url, notes: row.notes },
      });
      counts.updated++;
    } else {
      counts.unchanged++;
    }
  }
  return counts;
}

async function syncIronSetSpecs(rows: IronSetSpecRow[]): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, unchanged: 0 };

  // Build (mfr_slug, model, year) -> ironSetId map.
  const setMap = new Map<string, number>();
  const allSets = await db.ironSet.findMany({
    select: {
      id: true, modelName: true, releaseYear: true,
      manufacturer: { select: { slug: true } },
    },
  });
  for (const s of allSets) {
    setMap.set(`${s.manufacturer.slug}|${s.modelName}|${s.releaseYear}`, s.id);
  }

  for (const row of rows) {
    const key = `${row.manufacturer_slug}|${row.model_name}|${row.release_year}`;
    const ironSetId = setMap.get(key);
    if (!ironSetId) {
      throw fail(
        `iron-set-specs.csv: iron_set "${key.replace(/\|/g, " ")}" should have been upserted by now (internal error)`,
      );
    }

    const existing = await db.ironSetSpec.findUnique({
      where: { iron_set_specs_set_club_unique: { ironSetId, club: row.club } },
    });

    if (!existing) {
      await db.ironSetSpec.create({
        data: {
          ironSetId,
          club: row.club,
          loftDeg: row.loft_deg,
          lieDeg: row.lie_deg,
          offsetMm: row.offset_mm,
          lengthIn: row.length_in,
        },
      });
      counts.created++;
      continue;
    }

    // Compare numeric values via Decimal-aware comparison. Prisma returns
    // Decimal | null; CSV gives number | null. Treat both null as equal,
    // both non-null and equal-as-number as equal.
    const same =
      decEquals(existing.loftDeg, row.loft_deg) &&
      decEquals(existing.lieDeg, row.lie_deg) &&
      decEquals(existing.offsetMm, row.offset_mm) &&
      decEquals(existing.lengthIn, row.length_in);

    if (same) {
      counts.unchanged++;
    } else {
      await db.ironSetSpec.update({
        where: { id: existing.id },
        data: {
          loftDeg: row.loft_deg,
          lieDeg: row.lie_deg,
          offsetMm: row.offset_mm,
          lengthIn: row.length_in,
        },
      });
      counts.updated++;
    }
  }
  return counts;
}

// ---- Helpers ------------------------------------------------------------

function required(v: string | undefined, file: string, line: number, col: string): string {
  if (v === undefined || v.trim() === "") {
    throw fail(`${file} line ${line}: ${col} is required`);
  }
  return v.trim();
}

function emptyToNull(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function parseIntInRange(
  raw: string | undefined,
  file: string,
  line: number,
  col: string,
  range: { min: number; max: number },
): number {
  const v = required(raw, file, line, col);
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw fail(`${file} line ${line}: ${col} must be an integer (got "${v}")`);
  }
  if (n < range.min || n > range.max) {
    throw fail(
      `${file} line ${line}: ${col}=${n} is outside sane range [${range.min}, ${range.max}]`,
    );
  }
  return n;
}

function parseFloatInRange(
  raw: string | undefined,
  file: string,
  line: number,
  col: string,
  range: { min: number; max: number },
): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) {
    throw fail(`${file} line ${line}: ${col} must be a number (got "${raw}")`);
  }
  if (n < range.min || n > range.max) {
    throw fail(
      `${file} line ${line}: ${col}=${n} is outside sane range [${range.min}, ${range.max}]`,
    );
  }
  return n;
}

function assertUnique(values: string[], file: string, colDescription: string) {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  if (dupes.size > 0) {
    throw fail(
      `${file}: duplicate values for ${colDescription}: ${[...dupes].join(", ")}`,
    );
  }
}

// Decimal-aware equality. Prisma returns numbers as Decimal; we compare to
// plain numbers from the CSV.
function decEquals(a: { toString(): string } | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Number(a.toString()) === b;
}

function fail(msg: string): Error {
  return new Error(msg);
}

function printSummary(label: string, c: Counts) {
  console.log(`${label}: ${c.created} created, ${c.updated} updated, ${c.unchanged} unchanged`);
}
