"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Same look as inputClass, but a fixed width (inputClass is w-full, which would stretch the picker).
const control = "min-h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "custom", label: "Custom range" },
] as const;

/**
 * One period picker. Choosing a preset applies it straight away; "Custom range" reveals two dates
 * and applies once both are set. The period lives in the URL (shareable, reload-safe) and any other
 * query params on the page are kept.
 */
export function RangeFilter({ preset, from, to, error }: { preset: string; from?: string; to?: string; error?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [choice, setChoice] = useState(preset);
  const [start, setStart] = useState(from ?? "");
  const [end, setEnd] = useState(to ?? "");

  const go = (nextPreset: string, nextFrom: string, nextTo: string) => {
    const q = new URLSearchParams(current.toString());
    q.set("preset", nextPreset);
    q.delete("page");
    if (nextPreset === "custom") {
      q.set("from", nextFrom);
      q.set("to", nextTo);
    } else {
      q.delete("from");
      q.delete("to");
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        aria-label="Period"
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          if (e.target.value !== "custom") go(e.target.value, "", "");
        }}
        className={`${control} w-44`}
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {choice === "custom" ? (
        <>
          <label className="flex flex-col text-xs text-muted">
            From
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value && end) go("custom", e.target.value, end);
              }}
              className={`${control} w-40`}
            />
          </label>
          <label className="flex flex-col text-xs text-muted">
            To
            <input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                if (start && e.target.value) go("custom", start, e.target.value);
              }}
              className={`${control} w-40`}
            />
          </label>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
