import "server-only";
import type { ChatterEntry } from "@/components/ui/chatter";
import type { IconName } from "@/components/ui/icons";
import type { Actor } from "@/lib/auth/actor";
import { can } from "@/lib/permissions";
import { listEntityHistory } from "@/modules/audit";

/** Plain words for the recorded actions; anything not listed is turned into words from its key. */
const PHRASE: Record<string, string> = {
  "invoice.draft.created": "created the draft",
  "invoice.draft.updated": "updated the draft",
  "invoice.draft.line_added": "added a line",
  "invoice.draft.line_updated": "changed a line",
  "invoice.draft.line_removed": "removed a line",
  "invoice.issued": "issued the invoice",
  "invoice.cancelled": "cancelled the invoice",
  "payment.recorded": "recorded a receipt",
  "payment.confirmed": "confirmed the receipt",
  "payment.reversed": "reversed the receipt",
  "payment.voided": "voided the receipt",
  "expense.created": "created the expense",
  "expense.updated": "updated the expense",
  "expense.archived": "archived the expense",
  "expense.attachment.added": "attached a file",
  "expense_payment.recorded": "recorded a payment",
  "expense_payment.confirmed": "confirmed a payment",
  "expense_payment.reversed": "reversed a payment",
  "project.created": "created the project",
  "project.updated": "updated the project",
  "project.status_changed": "changed the stage",
  "project.owner_changed": "changed the owner",
  "project.member_added": "added a member",
  "project.member_removed": "removed a member",
  "project.member_role_changed": "changed a member's role",
  "project.team_assigned": "assigned a team",
  "project.team_unassigned": "removed a team",
  "project.document_added": "added a document",
  "project.document_removed": "removed a document",
  "employee.created": "created the employee",
  "employee.updated": "updated the details",
  "employee.deactivated": "deactivated the account",
  "employee.suspended": "suspended the account",
  "employee.reactivated": "reactivated the account",
  "employee.profile_image_changed": "changed the photo",
  "employee.profile_image_removed": "removed the photo",
  "client.created": "created the client",
  "client.updated": "updated the client",
};

const ICON: [RegExp, IconName][] = [
  [/cancel|revers|void|removed|deleted/, "cancelled"],
  [/archiv|deactivat|suspend/, "archived"],
  [/issued|confirmed|reactivated/, "completed"],
  [/created|added|recorded/, "plus"],
];

const HIDE = /(^id$|Id$|_id$|At$|_at$|^companyId$|idempotency)/;

function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "none";
  if (typeof v === "object") return "changed";
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}...` : s;
}

/** "Status: Draft → Issued" lines for the fields that changed, at most four. */
function changes(before: unknown, after: unknown): { field: string; from: string; to: string }[] {
  const b = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const a = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const out: { field: string; from: string; to: string }[] = [];
  for (const key of Object.keys(a)) {
    if (HIDE.test(key) || JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    if (typeof a[key] === "object" && a[key] !== null) continue;
    out.push({ field: humanize(key), from: show(b[key]), to: show(a[key]) });
    if (out.length === 4) break;
  }
  return out;
}

/** One record's recorded history as chatter entries. `null` when the viewer may not read the history. */
export async function auditChatterEntries(actor: Actor, entity: string, entityId: string): Promise<ChatterEntry[] | null> {
  if (!can(actor, "audit.read")) return null;
  const rows = await listEntityHistory(actor, entity, entityId).catch(() => []);
  return rows.map((r) => {
    const diff = changes(r.before, r.after);
    return {
      id: `audit-${r.id}`,
      author: r.actorName ?? "System",
      at: r.createdAt,
      kind: "change" as const,
      icon: ICON.find(([re]) => re.test(r.action))?.[1] ?? "dot",
      body: (
        <>
          {PHRASE[r.action] ?? humanize(r.action.split(".").slice(1).join(" ") || r.action).toLowerCase()}
          {diff.length > 0 ? (
            <span className="mt-0.5 block text-xs text-muted">
              {diff.map((d) => (
                <span key={d.field} className="mr-3 inline-block">
                  {d.field}:{" "}
                  {d.from === "none" ? null : (
                    <>
                      {d.from} <span aria-hidden="true">&rarr;</span>
                      <span className="sr-only">to</span>{" "}
                    </>
                  )}
                  <span className="font-medium text-body">{d.to}</span>
                </span>
              ))}
            </span>
          ) : null}
        </>
      ),
    };
  });
}
