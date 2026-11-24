import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/components/ui/format";
import { Pager } from "@/components/ui/pager";
import { EmptyState } from "@/components/ui/states";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { listAuditLog } from "@/modules/audit";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

type SP = { entity?: string; action?: string; from?: string; to?: string; page?: string };

function summarize(v: unknown): string {
  if (v === null || v === undefined) return "";
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  if (!can(actor, "audit.read")) notFound();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const list = await listAuditLog(actor, { entity: sp.entity || undefined, action: sp.action, from: sp.from, to: sp.to, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const href = (p: number) => ({ query: { ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.action ? { action: sp.action } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...(p > 1 ? { page: p } : {}) } });
  const filtered = Boolean(sp.entity || sp.action || sp.from || sp.to);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted">
        Every important change across the company: who did it, to what, and when. Entries cannot be edited or erased.
      </p>

      <form method="get" aria-label="Filter audit log" className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Area
          <select name="entity" defaultValue={sp.entity ?? ""} className={inputClass}>
            <option value="">Everything</option>
            {list.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Action contains
          <input name="action" defaultValue={sp.action ?? ""} placeholder="for example: invoice" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputClass} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonClass("primary")}>Apply filters</button>
          {filtered ? <Link href="/settings/audit" className={buttonClass("secondary")}>Clear</Link> : null}
        </div>
      </form>

      {list.rows.length === 0 ? (
        <EmptyState title="Nothing recorded" description={filtered ? "No entries match these filters." : "No changes have been recorded yet."} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[44rem] rounded-none border-0 text-left text-sm">
            <caption className="sr-only">Audit log, newest first</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">When</th>
                <th scope="col" className="px-3 py-2 font-semibold">Who</th>
                <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                <th scope="col" className="px-3 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTime(r.createdAt, actor.timezone)}</td>
                  <td className="px-3 py-2">{r.actorName ?? "System"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.action}</span>
                    <span className="block text-xs text-muted">
                      {r.entity} · <span className="break-all">{r.entityId}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-body">
                    {r.before ? <div><span className="text-muted">Before:</span> <span className="break-words">{summarize(r.before)}</span></div> : null}
                    {r.after ? <div><span className="text-muted">After:</span> <span className="break-words">{summarize(r.after)}</span></div> : null}
                    {!r.before && !r.after ? <span className="text-muted">—</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 text-xs text-muted">{list.total} {list.total === 1 ? "entry" : "entries"}</p>
      <Pager page={page} pages={pages} prevHref={page > 1 ? href(page - 1) : undefined} nextHref={page < pages ? href(page + 1) : undefined} />
    </div>
  );
}
