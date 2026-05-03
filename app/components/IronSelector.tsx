"use client";

import { useEffect, useState, useTransition } from "react";
import type { MakerOption, IronSetData } from "@/lib/iron-sets";

type ModelOption = { id: number; name: string };

type Props = {
  // Side label, e.g. "Iron A" or "Iron B"
  label: string;
  // The list of all makers that have at least one iron set. Provided by the
  // server-side page render so the Maker dropdown is populated immediately.
  makers: MakerOption[];
  // The currently-selected iron (if any), used to back-fill the dropdowns
  // when the URL contains ?a=<id> or ?b=<id>.
  selectedIron: IronSetData | null;
  // Called whenever a Model is selected (id) or any higher-up dropdown is
  // changed (null), so the parent can keep the URL in sync.
  onSelect: (id: number | null) => void;
};

// Outer wrapper: re-mounts the inner stateful component whenever the parent's
// selectedIron changes externally (e.g. deep-link navigation, URL edits). That
// way the inner component initializes its dropdown state directly from props
// in useState defaults -- no useEffect-driven prop->state sync needed.
export function IronSelector(props: Props) {
  const remountKey = props.selectedIron?.id ?? "unselected";
  return <IronSelectorInner key={remountKey} {...props} />;
}

function IronSelectorInner({ label, makers, selectedIron, onSelect }: Props) {
  // Dropdown state. Initialized from selectedIron once on mount; user input
  // mutates these via the change handlers.
  const [makerSlug, setMakerSlug] = useState<string>(
    selectedIron?.manufacturer.slug ?? "",
  );
  const [year, setYear] = useState<number | null>(
    selectedIron?.releaseYear ?? null,
  );
  const [modelId, setModelId] = useState<number | null>(selectedIron?.id ?? null);

  // Cascading dropdown options (fetched as the user picks).
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [, startTransition] = useTransition();

  // On mount, if we already have a selectedIron (deep link), pre-fetch the
  // years and models lists so the dropdowns show all options, not just the
  // currently-selected one. Empty deps: this runs only at mount; remounts are
  // handled by the outer wrapper's key.
  useEffect(() => {
    if (!selectedIron) return;
    void loadYears(selectedIron.manufacturer.slug);
    void loadModels(selectedIron.manufacturer.slug, selectedIron.releaseYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadYears(slug: string) {
    if (!slug) {
      setYears([]);
      return;
    }
    setYearsLoading(true);
    try {
      const res = await fetch(`/api/years?maker=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`years fetch failed: ${res.status}`);
      const data: number[] = await res.json();
      setYears(data);
    } finally {
      setYearsLoading(false);
    }
  }

  async function loadModels(slug: string, y: number) {
    if (!slug || !Number.isFinite(y)) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    try {
      const res = await fetch(
        `/api/models?maker=${encodeURIComponent(slug)}&year=${y}`,
      );
      if (!res.ok) throw new Error(`models fetch failed: ${res.status}`);
      const data: ModelOption[] = await res.json();
      setModels(data);
    } finally {
      setModelsLoading(false);
    }
  }

  function handleMakerChange(slug: string) {
    setMakerSlug(slug);
    setYear(null);
    setModelId(null);
    setYears([]);
    setModels([]);
    startTransition(() => onSelect(null));
    if (slug) void loadYears(slug);
  }

  function handleYearChange(yStr: string) {
    const y = yStr === "" ? null : Number(yStr);
    setYear(y);
    setModelId(null);
    setModels([]);
    startTransition(() => onSelect(null));
    if (makerSlug && y !== null) void loadModels(makerSlug, y);
  }

  function handleModelChange(idStr: string) {
    const id = idStr === "" ? null : Number(idStr);
    setModelId(id);
    startTransition(() => onSelect(id));
  }

  return (
    <div className="rounded-md border border-[color:var(--color-border-soft)] bg-white p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide font-semibold text-[color:var(--color-green-deep)]">
        {label}
      </div>
      <div className="space-y-2">
        <Dropdown
          id={`${label}-maker`}
          label="Maker"
          value={makerSlug}
          onChange={handleMakerChange}
          options={makers.map((m) => ({ value: m.slug, label: m.name }))}
          placeholder="Select maker"
        />
        <Dropdown
          id={`${label}-year`}
          label="Year"
          value={year === null ? "" : String(year)}
          onChange={handleYearChange}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          placeholder={
            !makerSlug
              ? "Pick a maker first"
              : yearsLoading
                ? "Loading..."
                : "Select year"
          }
          disabled={!makerSlug || yearsLoading}
        />
        <Dropdown
          id={`${label}-model`}
          label="Model"
          value={modelId === null ? "" : String(modelId)}
          onChange={handleModelChange}
          options={models.map((m) => ({ value: String(m.id), label: m.name }))}
          placeholder={
            !year
              ? "Pick a year first"
              : modelsLoading
                ? "Loading..."
                : "Select model"
          }
          disabled={year === null || modelsLoading}
        />
      </div>
      {selectedIron && (
        <div className="pt-2 border-t border-[color:var(--color-border-soft)] text-xs text-[color:var(--color-muted)]">
          <a
            href={selectedIron.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[color:var(--color-green-deep)]"
          >
            View source
          </a>
          {selectedIron.standardShaftLabel ? (
            <span className="ml-3">{selectedIron.standardShaftLabel}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Dropdown({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="grid grid-cols-[4rem_1fr] items-center gap-3">
      <span className="text-sm font-medium text-[color:var(--color-foreground)]">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="border border-[color:var(--color-border-soft)] bg-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-green-medium)] disabled:bg-[color:var(--color-row-dark)] disabled:text-[color:var(--color-muted)]"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
