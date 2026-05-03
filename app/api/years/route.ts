import { NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { manufacturers, ironSets } from "@/lib/db/schema";

// GET /api/years?maker=<slug>
// Returns distinct years that this manufacturer has iron sets in,
// sorted newest first.
// Shape: [2025, 2023, ...]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const makerSlug = searchParams.get("maker");
  if (!makerSlug) {
    return NextResponse.json(
      { error: "missing 'maker' query param" },
      { status: 400 },
    );
  }

  const rows = await db
    .selectDistinct({ year: ironSets.releaseYear })
    .from(ironSets)
    .innerJoin(manufacturers, sql`${ironSets.manufacturerId} = ${manufacturers.id}`)
    .where(eq(manufacturers.slug, makerSlug))
    .orderBy(desc(ironSets.releaseYear));

  return NextResponse.json(rows.map((r) => r.year));
}
