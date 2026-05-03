// Server-only data access for iron-set fetches that both the server-rendered
// page and the API routes need. Importing this from a client component will
// fail because db imports @prisma/client which expects a server env.

import type { Prisma } from "@prisma/client";
import { db } from "./db";

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
  return db.manufacturer.findMany({
    where: { ironSets: { some: {} } },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

// One iron set by primary key, with manufacturer and specs. Returns null if
// the id doesn't exist.
export async function getIronSet(id: number): Promise<IronSetData | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.ironSet.findUnique({
    where: { id },
    include: {
      manufacturer: { select: { id: true, name: true, slug: true } },
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
    specs: row.specs.map(serializeSpec),
  };
}

// Prisma returns Decimal columns as Decimal.js instances, which don't
// survive JSON serialization cleanly (they'd serialize to {s,e,d} objects).
// Stringify them at the data layer so consumers can pass them through
// JSON.stringify / Response.json() without surprises. The compare-page
// formatters in lib/format.ts already accept string | number | null.
function serializeSpec(s: {
  club: string;
  loftDeg: Prisma.Decimal | null;
  lieDeg: Prisma.Decimal | null;
  offsetMm: Prisma.Decimal | null;
  lengthIn: Prisma.Decimal | null;
}): IronSetSpecData {
  return {
    club: s.club,
    loftDeg: s.loftDeg?.toString() ?? null,
    lieDeg: s.lieDeg?.toString() ?? null,
    offsetMm: s.offsetMm?.toString() ?? null,
    lengthIn: s.lengthIn?.toString() ?? null,
  };
}
