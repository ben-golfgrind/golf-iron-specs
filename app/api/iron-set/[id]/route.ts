import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ironSets } from "@/lib/db/schema";

// GET /api/iron-set/<id>
// Returns the full iron set + its specs by primary key.
//
// Response shape (success):
//   {
//     id, modelName, releaseYear, sourceUrl, standardShaftLabel, notes,
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

  const row = await db.query.ironSets.findFirst({
    where: eq(ironSets.id, id),
    with: {
      manufacturer: true,
      specs: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    modelName: row.modelName,
    releaseYear: row.releaseYear,
    sourceUrl: row.sourceUrl,
    standardShaftLabel: row.standardShaftLabel,
    notes: row.notes,
    manufacturer: row.manufacturer,
    specs: row.specs.map((s) => ({
      club: s.club,
      loftDeg: s.loftDeg,
      lieDeg: s.lieDeg,
      offsetMm: s.offsetMm,
      lengthIn: s.lengthIn,
    })),
  });
}
