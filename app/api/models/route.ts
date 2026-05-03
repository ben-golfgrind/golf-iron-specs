import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { manufacturers, ironSets } from "@/lib/db/schema";

// GET /api/models?maker=<slug>&year=<n>
// Returns all iron sets for that maker+year, with their IDs so the client
// can directly identify the chosen iron without a follow-up lookup.
// Shape: [{ id, name }, ...]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const makerSlug = searchParams.get("maker");
  const yearStr = searchParams.get("year");
  const year = yearStr === null ? NaN : Number(yearStr);

  if (!makerSlug || !Number.isFinite(year)) {
    return NextResponse.json(
      { error: "missing or invalid 'maker' or 'year' query params" },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: ironSets.id,
      name: ironSets.modelName,
    })
    .from(ironSets)
    .innerJoin(manufacturers, sql`${ironSets.manufacturerId} = ${manufacturers.id}`)
    .where(and(eq(manufacturers.slug, makerSlug), eq(ironSets.releaseYear, year)))
    .orderBy(ironSets.modelName);

  return NextResponse.json(rows);
}
