import type { ReactNode } from "react";

export type DetailItem = { label: string; value: ReactNode };

/** Right-hand "Details" card: label/value pairs in a `<dl>`. Empty values render as an em dash. */
export function DetailsList({ title = "Details", items }: { title?: string; items: DetailItem[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {items.map((i) => (
          <div key={i.label} className="contents">
            <dt className="text-muted">{i.label}</dt>
            <dd className="m-0 min-w-0 break-words">
              {i.value === null || i.value === undefined || i.value === "" ? <span className="text-muted">—</span> : i.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
