import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { manufacturers, ironSets } from "@/lib/db/schema";

// GET /api/makers
// Returns all manufacturers that have at least one iron set, ordered by name.
// Shape: [{ name, slug }, ...]
export async function GET() {
  const rows = await db
    .selectDistinct({
      name: manufacturers.name,
      slug: manufacturers.slug,
    })
    .from(manufacturers)
    .innerJoin(ironSets, sql`${ironSets.manufacturerId} = ${manufacturers.id}`)
    .orderBy(manufacturers.name);

  return NextResponse.json(rows);
}
