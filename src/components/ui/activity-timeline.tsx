import type { ReactNode } from "react";
import { formatDateTime } from "./format";

export type TimelineEntry = { id: string; actor: string; text: ReactNode; at: Date };

/** Readable history: "Priya changed status from Pending to In Progress" with a timestamp. Order is kept as given. */
export function ActivityTimeline({ entries, timeZone }: { entries: TimelineEntry[]; timeZone?: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="flex flex-col text-sm">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          <span aria-hidden="true" className="relative mt-1.5 flex w-2 shrink-0 justify-center">
            <span className="size-2 rounded-full bg-border" />
            {i < entries.length - 1 ? <span className="absolute -bottom-5 left-1/2 top-3 w-px -translate-x-1/2 bg-border" /> : null}
          </span>
          <div className="min-w-0">
            <p>
              <span className="font-medium">{e.actor}</span> {e.text}
            </p>
            <time dateTime={e.at.toISOString()} className="text-xs text-muted">
              {formatDateTime(e.at, timeZone)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
