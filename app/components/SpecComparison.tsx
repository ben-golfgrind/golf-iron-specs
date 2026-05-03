"use client";

import { clubSortKey } from "@/lib/format";
import { SpecBlock } from "./SpecBlock";
import type { IronSetData, IronSetSpecData } from "@/lib/iron-sets";

type Props = {
  ironA: IronSetData | null;
  ironB: IronSetData | null;
};

const EM_DASH = "\u2014";

// Renders the per-club spec blocks for the selected pair (or single iron, or
// nothing). Computes the union of clubs across whichever irons are present
// and orders them short-to-long via clubSortKey.
export function SpecComparison({ ironA, ironB }: Props) {
  if (!ironA && !ironB) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--color-border-soft)] p-8 text-center text-[color:var(--color-muted)]">
        Pick an iron above to see its specs. Pick two to compare.
      </div>
    );
  }

  // Build per-club lookup maps.
  const aMap = new Map<string, IronSetSpecData>();
  if (ironA) for (const s of ironA.specs) aMap.set(s.club, s);
  const bMap = new Map<string, IronSetSpecData>();
  if (ironB) for (const s of ironB.specs) bMap.set(s.club, s);

  const allClubs = Array.from(new Set([...aMap.keys(), ...bMap.keys()])).sort(
    (x, y) => clubSortKey(x) - clubSortKey(y),
  );

  const showDelta = ironA !== null && ironB !== null;

  return (
    <div className="space-y-3">
      <ColumnHeader ironA={ironA} ironB={ironB} showDelta={showDelta} />
      {allClubs.map((club) => (
        <SpecBlock
          key={club}
          club={club}
          a={aMap.get(club) ?? null}
          b={bMap.get(club) ?? null}
          showDelta={showDelta}
        />
      ))}
    </div>
  );
}

function ColumnHeader({
  ironA,
  ironB,
  showDelta,
}: {
  ironA: IronSetData | null;
  ironB: IronSetData | null;
  showDelta: boolean;
}) {
  const titleA = ironA
    ? `${ironA.releaseYear} ${ironA.manufacturer.name} ${ironA.modelName}`
    : EM_DASH;
  const titleB = ironB
    ? `${ironB.releaseYear} ${ironB.manufacturer.name} ${ironB.modelName}`
    : EM_DASH;

  return (
    <div className="grid grid-cols-[5rem_5rem_1fr_1fr_1fr] items-end gap-x-0 text-xs uppercase tracking-wide text-[color:var(--color-muted)] px-1">
      <div />
      <div />
      <div className="px-3 pb-1 text-right font-semibold normal-case text-sm text-[color:var(--color-foreground)]">
        {titleA}
      </div>
      <div className="px-3 pb-1 text-right font-semibold normal-case text-sm text-[color:var(--color-foreground)]">
        {titleB}
      </div>
      <div className="px-3 pb-1 text-right">{showDelta ? "\u0394" : ""}</div>
    </div>
  );
}
