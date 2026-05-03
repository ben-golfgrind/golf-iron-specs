import { NextResponse } from "next/server";
import { getIronSet } from "@/lib/iron-sets";

// GET /api/iron-set/<id>
// Returns the full iron set + its specs by primary key.
//
// Response shape (success):
//   {
//     id, modelName, releaseYear, sourceUrl, notes,
//     manufacturer: { id, name, slug },
//     specs: [{ club, loftDeg, lieDeg, offsetMm, lengthIn }]
//   }
// Numeric spec values are returned as strings (Drizzle preserves precision).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const ironSet = await getIronSet(id);
  if (!ironSet) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(ironSet);
}
