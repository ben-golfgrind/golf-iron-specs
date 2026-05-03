import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  manufacturers,
  ironSets,
  ironSetSpecs,
  type ClubNumber,
} from "@/lib/db/schema";

// Phase 1 seed data: 2025 Titleist T100.
// Source: https://fairwayjockey.com/products/titleist-2025-t100-custom-irons
// The Fairway Jockey spec table publishes loft / lie / length per club, but no
// offset values, so offset is left null for every row. The "W" wedge is mapped
// to our enum's "GW" (gap wedge).
const SOURCE_URL =
  "https://fairwayjockey.com/products/titleist-2025-t100-custom-irons";

type SeedSpec = {
  club: ClubNumber;
  loftDeg: number | null;
  lieDeg: number | null;
  offsetMm: number | null;
  lengthIn: number | null;
};

const T100_2025_SPECS: SeedSpec[] = [
  { club: "3i", loftDeg: 20.0, lieDeg: 61.0, offsetMm: null, lengthIn: 39.0 },
  { club: "4i", loftDeg: 23.0, lieDeg: 61.5, offsetMm: null, lengthIn: 38.5 },
  { club: "5i", loftDeg: 26.0, lieDeg: 62.0, offsetMm: null, lengthIn: 38.0 },
  { club: "6i", loftDeg: 29.0, lieDeg: 62.5, offsetMm: null, lengthIn: 37.5 },
  { club: "7i", loftDeg: 33.0, lieDeg: 63.0, offsetMm: null, lengthIn: 37.0 },
  { club: "8i", loftDeg: 37.0, lieDeg: 63.5, offsetMm: null, lengthIn: 36.5 },
  { club: "9i", loftDeg: 41.0, lieDeg: 64.0, offsetMm: null, lengthIn: 36.0 },
  { club: "PW", loftDeg: 45.0, lieDeg: 64.0, offsetMm: null, lengthIn: 35.75 },
  { club: "GW", loftDeg: 49.0, lieDeg: 64.0, offsetMm: null, lengthIn: 35.5 },
];

function toNumericString(value: number | null): string | null {
  return value === null ? null : value.toString();
}

async function main() {
  console.log("Seeding database...");

  // Upsert Titleist manufacturer.
  const titleistName = "Titleist";
  const titleistSlug = "titleist";
  let titleist = await db.query.manufacturers.findFirst({
    where: eq(manufacturers.slug, titleistSlug),
  });
  if (!titleist) {
    [titleist] = await db
      .insert(manufacturers)
      .values({ name: titleistName, slug: titleistSlug })
      .returning();
    console.log(`  Inserted manufacturer: ${titleist.name} (id=${titleist.id})`);
  } else {
    console.log(
      `  Manufacturer already exists: ${titleist.name} (id=${titleist.id})`,
    );
  }

  // Upsert iron set: Titleist T100 (2025).
  const modelName = "T100";
  const releaseYear = 2025;
  let t100 = await db.query.ironSets.findFirst({
    where: and(
      eq(ironSets.manufacturerId, titleist.id),
      eq(ironSets.modelName, modelName),
      eq(ironSets.releaseYear, releaseYear),
    ),
  });
  if (!t100) {
    [t100] = await db
      .insert(ironSets)
      .values({
        manufacturerId: titleist.id,
        modelName,
        releaseYear,
        standardShaftLabel: null,
        sourceUrl: SOURCE_URL,
        notes: null,
      })
      .returning();
    console.log(
      `  Inserted iron set: ${releaseYear} ${titleist.name} ${modelName} (id=${t100.id})`,
    );
  } else {
    console.log(
      `  Iron set already exists: ${releaseYear} ${titleist.name} ${modelName} (id=${t100.id})`,
    );
  }

  // Upsert per-club specs. We delete-and-replace for idempotency on re-runs.
  await db.delete(ironSetSpecs).where(eq(ironSetSpecs.ironSetId, t100.id));
  await db.insert(ironSetSpecs).values(
    T100_2025_SPECS.map((s) => ({
      ironSetId: t100!.id,
      club: s.club,
      loftDeg: toNumericString(s.loftDeg),
      lieDeg: toNumericString(s.lieDeg),
      offsetMm: toNumericString(s.offsetMm),
      lengthIn: toNumericString(s.lengthIn),
    })),
  );
  console.log(`  Inserted ${T100_2025_SPECS.length} spec rows`);

  // Verification read-back.
  const verify = await db.query.ironSets.findFirst({
    where: eq(ironSets.id, t100.id),
    with: {
      manufacturer: true,
      specs: true,
    },
  });
  if (!verify) {
    throw new Error("Verification read-back failed: iron set not found");
  }
  console.log("");
  console.log("Verification read-back:");
  console.log(
    `  ${verify.releaseYear} ${verify.manufacturer.name} ${verify.modelName}`,
  );
  console.log(`  source: ${verify.sourceUrl}`);
  console.log(`  specs (${verify.specs.length} rows):`);
  for (const s of verify.specs) {
    console.log(
      `    ${s.club.padEnd(3)}  loft=${s.loftDeg ?? "-"}  lie=${s.lieDeg ?? "-"}  offset=${s.offsetMm ?? "-"}  length=${s.lengthIn ?? "-"}`,
    );
  }
  console.log("");
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
