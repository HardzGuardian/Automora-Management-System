"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * A select that saves when changed, for rows where a separate Save button would be noise.
 * Works as a normal form with JavaScript on; the visible label stays for screen readers.
 */
export function AutoSubmitSelect({
  action,
  name,
  value,
  label,
  options,
  hidden,
  disabled,
  className,
}: {
  action: (fd: FormData) => void | Promise<void>;
  name: string;
  value: string;
  label: string;
  options: { value: string; label: string }[];
  hidden: Record<string, string>;
  disabled?: boolean;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor={`${name}-${hidden.id ?? hidden.taskId ?? ""}`}>
        {label}
      </label>
      <select
        id={`${name}-${hidden.id ?? hidden.taskId ?? ""}`}
        name={name}
        defaultValue={value}
        disabled={disabled}
        onChange={() => form.current?.requestSubmit()}
        className={cn("h-10 rounded-lg border px-2 text-sm disabled:opacity-60", className ?? "border-field bg-surface text-foreground")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
