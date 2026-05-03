import { NextResponse } from "next/server";
import { getMakers } from "@/lib/iron-sets";

// GET /api/makers
// Returns all manufacturers that have at least one iron set, ordered by name.
// Shape: [{ name, slug }, ...]
export async function GET() {
  const rows = await getMakers();
  return NextResponse.json(rows);
}
