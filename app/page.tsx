import { Suspense } from "react";
import { CompareApp } from "./components/CompareApp";
import { getMakers, getIronSet } from "@/lib/iron-sets";

type SearchParams = Promise<{ a?: string; b?: string }>;

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Home page IS the compare page. Fetches the makers list (so the Maker
// dropdown is populated on first paint) and any irons referenced by ?a= or
// ?b= search params (so deep links render the spec table without a waterfall).
// Everything below is interactive and lives in CompareApp (client).
export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const aId = parseId(params.a);
  const bId = parseId(params.b);

  const [makers, initialIronA, initialIronB] = await Promise.all([
    getMakers(),
    aId !== null ? getIronSet(aId) : Promise.resolve(null),
    bId !== null ? getIronSet(bId) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-full px-4 py-8 md:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[color:var(--color-green-deep)]">
            CompareIronSpecs
          </h1>
          <p className="text-sm md:text-base text-[color:var(--color-muted)]">
            Compare iron specs (loft, lie, length, offset) across makers and
            years.
          </p>
        </header>

        {makers.length === 0 ? (
          <EmptyDatabase />
        ) : (
          <Suspense>
            <CompareApp
              makers={makers}
              initialIronA={initialIronA}
              initialIronB={initialIronB}
            />
          </Suspense>
        )}

        <footer className="pt-4 border-t border-[color:var(--color-border-soft)] text-xs text-[color:var(--color-muted)]">
          Specs are sourced from publishers (manufacturers, retailers). Click
          &ldquo;View source&rdquo; on any iron to verify.
        </footer>
      </div>
    </div>
  );
}

function EmptyDatabase() {
  return (
    <div className="rounded-md border border-dashed border-[color:var(--color-border-soft)] p-8 text-center text-[color:var(--color-muted)]">
      <p className="font-medium text-[color:var(--color-foreground)]">
        No irons in the database yet.
      </p>
      <p className="mt-1 text-sm">
        Add some via the admin section once it&rsquo;s built (Phase 3), or run{" "}
        <code className="font-mono text-xs">npm run db:seed</code> to insert
        the seed iron.
      </p>
    </div>
  );
}
