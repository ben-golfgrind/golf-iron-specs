// Display-formatting helpers for iron specs and per-spec deltas.
//
// Drizzle returns numeric columns as strings (to preserve precision); these
// helpers accept string | number | null and produce display strings.

export type Numericish = string | number | null | undefined;

const EM_DASH = "\u2014";

function toNumber(v: Numericish): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Format a positive number with up to `maxDecimals` decimals, trimming
// trailing zeros. e.g. trimDecimals(20, 1) === "20", trimDecimals(20.5, 1) === "20.5".
function trimDecimals(n: number, maxDecimals: number): string {
  return n
    .toFixed(maxDecimals)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

export function formatLoft(v: Numericish): string {
  const n = toNumber(v);
  return n === null ? EM_DASH : `${trimDecimals(n, 1)}\u00b0`;
}

export function formatLie(v: Numericish): string {
  const n = toNumber(v);
  return n === null ? EM_DASH : `${trimDecimals(n, 1)}\u00b0`;
}

export function formatOffset(v: Numericish): string {
  const n = toNumber(v);
  return n === null ? EM_DASH : `${trimDecimals(n, 2)}mm`;
}

export function formatLength(v: Numericish): string {
  const n = toNumber(v);
  return n === null ? EM_DASH : `${trimDecimals(n, 3)}\u201d`;
}

// Delta formatting: B - A. Returns { text, sign }, where sign is one of
// "positive" | "negative" | "zero" | "unknown" so the caller can color it.
export type DeltaSign = "positive" | "negative" | "zero" | "unknown";

export type FormattedDelta = {
  text: string;
  sign: DeltaSign;
};

function buildDelta(
  a: Numericish,
  b: Numericish,
  maxDecimals: number,
  unit: string,
): FormattedDelta {
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an === null || bn === null) return { text: EM_DASH, sign: "unknown" };
  const diff = bn - an;
  if (Math.abs(diff) < Math.pow(10, -maxDecimals) / 2) {
    return { text: `0${unit}`, sign: "zero" };
  }
  const sign: DeltaSign = diff > 0 ? "positive" : "negative";
  const prefix = diff > 0 ? "+" : "\u2212"; // unicode minus for nicer alignment
  const abs = Math.abs(diff);
  return { text: `${prefix}${trimDecimals(abs, maxDecimals)}${unit}`, sign };
}

export function deltaLoft(a: Numericish, b: Numericish): FormattedDelta {
  return buildDelta(a, b, 1, "\u00b0");
}

export function deltaLie(a: Numericish, b: Numericish): FormattedDelta {
  return buildDelta(a, b, 1, "\u00b0");
}

export function deltaOffset(a: Numericish, b: Numericish): FormattedDelta {
  return buildDelta(a, b, 2, "mm");
}

export function deltaLength(a: Numericish, b: Numericish): FormattedDelta {
  return buildDelta(a, b, 3, "\u201d");
}

export function deltaSignClass(sign: DeltaSign): string {
  switch (sign) {
    case "positive":
      return "text-[color:var(--color-delta-positive)]";
    case "negative":
      return "text-[color:var(--color-delta-negative)]";
    case "zero":
    case "unknown":
      return "text-[color:var(--color-delta-zero)]";
  }
}

// Display-order for clubs: short (highest loft) to long. Used to sort the
// per-club spec blocks. Lower index = displayed earlier (top of the page).
export const CLUB_DISPLAY_ORDER: ReadonlyArray<string> = [
  "LW",
  "SW",
  "AW",
  "GW",
  "PW",
  "9i",
  "8i",
  "7i",
  "6i",
  "5i",
  "4i",
  "3i",
  "2i",
  "1i",
];

export function clubSortKey(club: string): number {
  const idx = CLUB_DISPLAY_ORDER.indexOf(club);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}
