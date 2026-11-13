import { cn } from "@/lib/cn";
import { buttonClass, inputClass } from "@/components/ui/styles";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "custom", label: "Custom" },
] as const;

/** GET form: the selected period lives in the URL so it can be shared and reloaded. */
export function RangeFilter({ preset, from, to, error }: { preset: string; from?: string; to?: string; error?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-2" aria-label="Period">
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">Period</legend>
        {PRESETS.map((p) => (
          <label key={p.value} className={cn("cursor-pointer rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold", "border-border bg-surface")}>
            <input type="radio" name="preset" value={p.value} defaultChecked={preset === p.value} className="sr-only" />
            {p.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col text-xs text-muted">
        From
        <input type="date" name="from" defaultValue={from} className={cn(inputClass, "w-40")} />
      </label>
      <label className="flex flex-col text-xs text-muted">
        To
        <input type="date" name="to" defaultValue={to} className={cn(inputClass, "w-40")} />
      </label>
      <button type="submit" className={buttonClass("secondary")}>
        Apply
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
