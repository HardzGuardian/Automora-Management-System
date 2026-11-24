import { formatDateTime } from "@/components/ui/format";
import { can } from "@/lib/permissions";
import type { Actor } from "@/lib/auth/actor";
import { listEntityHistory } from "@/modules/audit";

/** "History" on a detail page: every recorded change to this one record. Shown only to people with audit.read. */
export async function HistoryPanel({ actor, entity, entityId }: { actor: Actor; entity: string; entityId: string }) {
  if (!can(actor, "audit.read")) return null;
  const rows = await listEntityHistory(actor, entity, entityId).catch(() => []);
  return (
    <section aria-label="History" className="rounded-lg border border-border bg-surface">
      <h2 className="m-0 border-b border-border px-5 py-3.5 text-base font-semibold text-foreground">History</h2>
      {rows.length === 0 ? (
        <p className="m-0 px-5 py-4 text-sm text-muted">No changes recorded.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-border px-5 py-2.5 text-sm first:border-t-0">
              <span>
                <span className="font-medium">{r.action}</span>
                <span className="text-muted"> by {r.actorName ?? "System"}</span>
              </span>
              <span className="text-xs tabular-nums text-muted">{formatDateTime(r.createdAt, actor.timezone)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
