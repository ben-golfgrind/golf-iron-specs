import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  const rows = await db.ironSet.findMany({
    where: {
      manufacturer: { slug: makerSlug },
      releaseYear: year,
    },
    select: {
      id: true,
      modelName: true,
    },
    orderBy: { modelName: "asc" },
  });

  return NextResponse.json(rows.map((r) => ({ id: r.id, name: r.modelName })));
}
