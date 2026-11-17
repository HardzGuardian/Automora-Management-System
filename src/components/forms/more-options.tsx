import type { ReactNode } from "react";

/**
 * Optional fields tucked behind one toggle, so a form opens with only what is needed.
 * Fields inside a closed <details> are still submitted with the form.
 */
export function MoreOptions({ children, label = "More options", defaultOpen = false }: { children: ReactNode; label?: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-border bg-background">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-primary">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          ▸
        </span>
        {label}
      </summary>
      <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}
