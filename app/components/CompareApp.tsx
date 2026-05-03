"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IronSetData, MakerOption } from "@/lib/iron-sets";
import { IronSelector } from "./IronSelector";
import { SpecComparison } from "./SpecComparison";

type Props = {
  makers: MakerOption[];
  initialIronA: IronSetData | null;
  initialIronB: IronSetData | null;
};

// Top-level client component for the compare page. Owns the two IronSelectors
// and the SpecComparison. Holds an in-memory cache of fetched iron sets keyed
// by id so flipping between previously-selected irons is instant.
export function CompareApp({ makers, initialIronA, initialIronB }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Iron-set cache keyed by id. Seeded with the server-provided initial irons.
  const [cache, setCache] = useState<Map<number, IronSetData>>(() => {
    const m = new Map<number, IronSetData>();
    if (initialIronA) m.set(initialIronA.id, initialIronA);
    if (initialIronB) m.set(initialIronB.id, initialIronB);
    return m;
  });

  // Currently-displayed iron-set ids, parsed from URL search params.
  const aId = parseId(searchParams.get("a"));
  const bId = parseId(searchParams.get("b"));
  const ironA = aId !== null ? (cache.get(aId) ?? null) : null;
  const ironB = bId !== null ? (cache.get(bId) ?? null) : null;

  // When the URL points at an iron we don't have in cache yet, fetch it.
  useEffect(() => {
    void ensureCached(aId);
    void ensureCached(bId);
    // ensureCached is stable enough; aId/bId trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, bId]);

  async function ensureCached(id: number | null) {
    if (id === null) return;
    if (cache.has(id)) return;
    try {
      const res = await fetch(`/api/iron-set/${id}`);
      if (!res.ok) {
        // Silently drop bad ids (e.g., stale shared link). The selector will
        // appear empty for that side; the URL still contains the bad id but
        // the SpecComparison renders the unselected state.
        return;
      }
      const data: IronSetData = await res.json();
      setCache((prev) => {
        const next = new Map(prev);
        next.set(data.id, data);
        return next;
      });
    } catch {
      // Network error -- leave that side unselected.
    }
  }

  const handleSelect = useCallback(
    (side: "a" | "b", id: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === null) {
        params.delete(side);
      } else {
        params.set(side, String(id));
        // Pre-fetch into cache so the spec block renders without a flicker.
        void ensureCached(id);
      }
      const qs = params.toString();
      const url = qs.length > 0 ? `/?${qs}` : "/";
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    // ensureCached is stable; intentionally only re-bound when searchParams or
    // router identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, router],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IronSelector
          label="Iron A"
          makers={makers}
          selectedIron={ironA}
          onSelect={(id) => handleSelect("a", id)}
        />
        <IronSelector
          label="Iron B"
          makers={makers}
          selectedIron={ironB}
          onSelect={(id) => handleSelect("b", id)}
        />
      </div>
      <SpecComparison ironA={ironA} ironB={ironB} />
    </div>
  );
}

function parseId(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
