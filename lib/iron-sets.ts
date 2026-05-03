// Server-only data access for iron-set fetches that both the server-rendered
// page and the API routes need. Importing this from a client component will
// fail because db imports neon-http which expects server env.

import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { manufacturers, ironSets } from "./db/schema";

export type IronSetSpecData = {
  club: string;
  loftDeg: string | null;
  lieDeg: string | null;
  offsetMm: string | null;
  lengthIn: string | null;
};

export type IronSetData = {
  id: number;
  modelName: string;
  releaseYear: number;
  sourceUrl: string;
  standardShaftLabel: string | null;
  notes: string | null;
  manufacturer: {
    id: number;
    name: string;
    slug: string;
  };
  specs: IronSetSpecData[];
};

export type MakerOption = {
  name: string;
  slug: string;
};

// All manufacturers that have at least one iron set, ordered by name.
export async function getMakers(): Promise<MakerOption[]> {
  return db
    .selectDistinct({
      name: manufacturers.name,
      slug: manufacturers.slug,
    })
    .from(manufacturers)
    .innerJoin(ironSets, sql`${ironSets.manufacturerId} = ${manufacturers.id}`)
    .orderBy(manufacturers.name);
}

// One iron set by primary key, with manufacturer and specs. Returns null if
// the id doesn't exist.
export async function getIronSet(id: number): Promise<IronSetData | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.query.ironSets.findFirst({
    where: eq(ironSets.id, id),
    with: {
      manufacturer: true,
      specs: true,
    },
  });
  if (!row) return null;
  return {
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
  };
}
