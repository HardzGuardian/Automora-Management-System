"use client";

/** Header checkbox that ticks or clears every row checkbox named `taskId` in the page. */
export function SelectAll({ label = "Select all tasks" }: { label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4"
      onChange={(e) => {
        const on = e.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="taskId"]').forEach((c) => {
          c.checked = on;
        });
      }}
    />
  );
}
