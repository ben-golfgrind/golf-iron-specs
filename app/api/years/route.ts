import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  const rows = await db.ironSet.findMany({
    where: { manufacturer: { slug: makerSlug } },
    select: { releaseYear: true },
    distinct: ["releaseYear"],
    orderBy: { releaseYear: "desc" },
  });

  return NextResponse.json(rows.map((r) => r.releaseYear));
}
