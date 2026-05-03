"use client";

import {
  formatLoft,
  formatLie,
  formatOffset,
  formatLength,
  deltaLoft,
  deltaLie,
  deltaOffset,
  deltaLength,
  deltaSignClass,
  type FormattedDelta,
} from "@/lib/format";

type SpecRow = {
  loftDeg: string | null;
  lieDeg: string | null;
  offsetMm: string | null;
  lengthIn: string | null;
};

type Props = {
  club: string;
  // Either side may be null (means: that iron is unselected, or doesn't have
  // this club). When both sides are non-null, the delta column is shown.
  a: SpecRow | null;
  b: SpecRow | null;
  showDelta: boolean;
};

const EM_DASH = "\u2014";

// One per-club block. Layout (locked plan):
//
//   Club label | Loft   | A value  | B value  | Delta value
//              | Lie    | A value  | B value  | Delta value
//              | Length | A value  | B value  | Delta value
//              | Offset | A value  | B value  | Delta value
//
// Both A and B columns always render (A on the left, B on the right) so
// the alignment is identical across blocks. The Delta column only renders
// when showDelta is true (i.e. both irons selected).
export function SpecBlock({ club, a, b, showDelta }: Props) {
  const rows: Array<{
    label: string;
    aValue: string;
    bValue: string;
    delta: FormattedDelta | null;
  }> = [
    {
      label: "Loft",
      aValue: a ? formatLoft(a.loftDeg) : EM_DASH,
      bValue: b ? formatLoft(b.loftDeg) : EM_DASH,
      delta: showDelta && a && b ? deltaLoft(a.loftDeg, b.loftDeg) : null,
    },
    {
      label: "Lie",
      aValue: a ? formatLie(a.lieDeg) : EM_DASH,
      bValue: b ? formatLie(b.lieDeg) : EM_DASH,
      delta: showDelta && a && b ? deltaLie(a.lieDeg, b.lieDeg) : null,
    },
    {
      label: "Length",
      aValue: a ? formatLength(a.lengthIn) : EM_DASH,
      bValue: b ? formatLength(b.lengthIn) : EM_DASH,
      delta: showDelta && a && b ? deltaLength(a.lengthIn, b.lengthIn) : null,
    },
    {
      label: "Offset",
      aValue: a ? formatOffset(a.offsetMm) : EM_DASH,
      bValue: b ? formatOffset(b.offsetMm) : EM_DASH,
      delta: showDelta && a && b ? deltaOffset(a.offsetMm, b.offsetMm) : null,
    },
  ];

  return (
    <div className="rounded-md border border-[color:var(--color-border-soft)] overflow-hidden">
      <div className="grid grid-cols-[5rem_5rem_1fr_1fr_1fr] items-stretch text-sm">
        <div
          className="row-span-4 flex items-center justify-center bg-[color:var(--color-green-deep)] text-white font-semibold text-base"
          style={{ gridRow: "span 4" }}
        >
          {club}
        </div>
        {rows.map((row, i) => {
          const bgClass =
            i % 2 === 0
              ? "bg-[color:var(--color-row-light)]"
              : "bg-[color:var(--color-row-dark)]";
          return (
            <div
              key={row.label}
              className={`contents`}
              role="row"
              aria-label={`${club} ${row.label}`}
            >
              <div
                className={`${bgClass} px-3 py-2 font-medium text-[color:var(--color-muted)]`}
              >
                {row.label}
              </div>
              <div className={`${bgClass} px-3 py-2 spec-num text-right`}>
                {row.aValue}
              </div>
              <div className={`${bgClass} px-3 py-2 spec-num text-right`}>
                {row.bValue}
              </div>
              <div
                className={`${bgClass} px-3 py-2 spec-num text-right ${
                  showDelta && row.delta
                    ? deltaSignClass(row.delta.sign)
                    : "text-[color:var(--color-delta-zero)]"
                }`}
              >
                {showDelta ? (row.delta ? row.delta.text : EM_DASH) : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
