import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";
import { formatDateTime } from "./format";

/**
 * Odoo's chatter: everything that happened on a record in one place. Messages (comments, notes) show the
 * author's initial; tracked changes ("Status: Pending to In Progress") are smaller lines with an icon.
 * Newest first, grouped by day in the company's time zone.
 */
export type ChatterEntry = {
  id: string;
  author: string;
  at: Date;
  kind: "message" | "change";
  body: ReactNode;
  icon?: IconName;
  /** e.g. an Edit/Delete control for the author's own comment. */
  actions?: ReactNode;
};

function dayKey(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function Chatter({
  entries,
  composer,
  timeZone,
  title = "Chatter",
  empty = "Nothing has happened here yet.",
  className,
}: {
  entries: ChatterEntry[];
  composer?: ReactNode;
  timeZone?: string;
  title?: string;
  empty?: string;
  className?: string;
}) {
  const sorted = [...entries].sort((a, b) => b.at.getTime() - a.at.getTime());
  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  const yesterdayKey = dayKey(new Date(now.getTime() - 86_400_000), timeZone);
  const groups: { key: string; items: ChatterEntry[] }[] = [];
  for (const e of sorted) {
    const k = dayKey(e.at, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(e);
    else groups.push({ key: k, items: [e] });
  }

  return (
    <section aria-label={title} className={cn("rounded-2xl border border-border bg-surface shadow-[var(--elev-1)]", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon name="comment" size={17} className="text-primary" />
        <h2 className="m-0 text-sm font-semibold text-foreground">{title}</h2>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted">{entries.length}</span>
      </div>
      {composer ? <div className="border-b border-border px-4 py-3">{composer}</div> : null}
      {groups.length === 0 ? (
        <p className="m-0 px-4 py-5 text-sm text-muted">{empty}</p>
      ) : (
        <div className="px-4 py-3">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="my-2 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                <span className="h-px flex-1 bg-border" />
                {dayLabel(g.key, todayKey, yesterdayKey)}
                <span className="h-px flex-1 bg-border" />
              </div>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {g.items.map((e) =>
                  e.kind === "message" ? (
                    <li key={e.id} className="flex gap-3">
                      <span aria-hidden="true" className="mt-0.5 inline-flex size-8 flex-none items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-ink">
                        {e.author.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[13px]">
                          <span className="font-semibold text-foreground">{e.author}</span>{" "}
                          <time dateTime={e.at.toISOString()} className="text-xs text-muted">
                            {formatDateTime(e.at, timeZone)}
                          </time>
                        </p>
                        <div className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-background px-3 py-2 text-sm text-body">{e.body}</div>
                        {e.actions ? <div className="mt-1">{e.actions}</div> : null}
                      </div>
                    </li>
                  ) : (
                    <li key={e.id} className="flex gap-3 text-[13px]">
                      <span aria-hidden="true" className="mt-0.5 inline-flex size-8 flex-none items-center justify-center text-muted">
                        <Icon name={e.icon ?? "dot"} size={15} strokeWidth={e.icon ? 2 : 4} />
                      </span>
                      <p className="m-0 min-w-0 flex-1 text-body">
                        <span className="font-medium text-foreground">{e.author}</span> {e.body}
                        <time dateTime={e.at.toISOString()} className="block text-xs text-muted">
                          {formatDateTime(e.at, timeZone)}
                        </time>
                      </p>
                    </li>
                  ),
                )}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
