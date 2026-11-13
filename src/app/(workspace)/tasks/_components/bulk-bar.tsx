"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/ui/styles";

const CHECKBOX = (formId: string, name: string) => `input[type="checkbox"][form="${formId}"][name="${name}"]`;

/** Header checkbox: ticks or unticks every row on the page. */
export function SelectAll({ formId, name }: { formId: string; name: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all on this page"
      className="size-4 accent-primary"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(CHECKBOX(formId, name)).forEach((box) => {
          box.checked = e.target.checked;
        });
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}

/**
 * The bulk-action bar: invisible until at least one row is ticked, then sticks under the header
 * with the count, the action and Apply. The row checkboxes belong to this form through `form=`.
 */
export function BulkBar({
  formId,
  name,
  action,
  children,
}: {
  formId: string;
  /** Name of the row checkboxes this bar counts. */
  name: string;
  action: (formData: FormData) => void | Promise<void>;
  /** The <option>s of the action picker. */
  children: ReactNode;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(document.querySelectorAll(`${CHECKBOX(formId, name)}:checked`).length);
    read();
    document.addEventListener("change", read);
    return () => document.removeEventListener("change", read);
  }, [formId, name]);

  const clear = () => {
    document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][form="${formId}"], thead input[type="checkbox"]`).forEach((box) => {
      box.checked = false;
    });
    document.dispatchEvent(new Event("change"));
  };

  return (
    <form
      id={formId}
      action={action}
      className={count === 0 ? "hidden" : "sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2 text-sm shadow-sm"}
    >
      <span role="status" className="px-2 font-medium">
        {count} selected
      </span>
      <select name="op" className={`${inputClass} sm:w-56`} aria-label="Bulk action">
        {children}
      </select>
      <button type="submit" className={buttonClass("primary")}>
        Apply
      </button>
      <button type="button" onClick={clear} className={buttonClass("ghost")}>
        Clear selection
      </button>
    </form>
  );
}
