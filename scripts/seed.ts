import "dotenv/config";
import { db } from "@/lib/db";

// Phase 1 seed data: 2025 Titleist T100.
// Source: https://fairwayjockey.com/products/titleist-2025-t100-custom-irons
// The Fairway Jockey spec table publishes loft / lie / length per club, but no
// offset values, so offset is left null for every row. The "W" wedge is mapped
// to "GW" (gap wedge).
const SOURCE_URL =
  "https://fairwayjockey.com/products/titleist-2025-t100-custom-irons";

type SeedSpec = {
  club: string;
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

async function main() {
  console.log("Seeding database...");

  // Upsert Titleist manufacturer.
  const titleist = await db.manufacturer.upsert({
    where: { slug: "titleist" },
    update: {},
    create: { name: "Titleist", slug: "titleist" },
  });
  console.log(`  Manufacturer: ${titleist.name} (id=${titleist.id})`);

  // Upsert iron set: Titleist T100 (2025).
  const modelName = "T100";
  const releaseYear = 2025;
  const ironSet = await db.ironSet.upsert({
    where: {
      iron_sets_mfr_model_year_unique: {
        manufacturerId: titleist.id,
        modelName,
        releaseYear,
      },
    },
    update: { sourceUrl: SOURCE_URL },
    create: {
      manufacturerId: titleist.id,
      modelName,
      releaseYear,
      sourceUrl: SOURCE_URL,
    },
  });
  console.log(
    `  Iron set: ${releaseYear} ${titleist.name} ${modelName} (id=${ironSet.id})`,
  );

  // Replace specs idempotently: delete existing rows for this iron set, then
  // insert the canonical list. Avoids drift when seed values are tweaked.
  await db.ironSetSpec.deleteMany({ where: { ironSetId: ironSet.id } });
  await db.ironSetSpec.createMany({
    data: T100_2025_SPECS.map((s) => ({
      ironSetId: ironSet.id,
      club: s.club,
      loftDeg: s.loftDeg,
      lieDeg: s.lieDeg,
      offsetMm: s.offsetMm,
      lengthIn: s.lengthIn,
    })),
  });
  console.log(`  Inserted ${T100_2025_SPECS.length} spec rows`);

  // Verification read-back.
  const verify = await db.ironSet.findUnique({
    where: { id: ironSet.id },
    include: { manufacturer: true, specs: true },
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
      `    ${s.club.padEnd(3)}  loft=${s.loftDeg?.toString() ?? "-"}  lie=${s.lieDeg?.toString() ?? "-"}  offset=${s.offsetMm?.toString() ?? "-"}  length=${s.lengthIn?.toString() ?? "-"}`,
    );
  }
  console.log("");
  console.log("Done.");
}

main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await db.$disconnect();
    process.exit(1);
  });
