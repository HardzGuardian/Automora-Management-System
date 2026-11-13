import "server-only";
import type { Actor } from "@/lib/auth/actor";
import { can } from "@/lib/permissions";
import { listExpenses, listInvoices, listReceipts } from "@/modules/finance";
import { listTasks } from "@/modules/tasks";
import { money } from "../invoices/_components/finance-ui";
import type { LinkedRow } from "./linked-records";

const LATEST = 8;

export type LinkedList = { rows: LinkedRow[]; total: number };

/** A finance problem must never break the page it is shown on, so a failed list is simply left out. */
async function safe<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

/** The client's or project's latest tasks, limited to the tasks the viewer may see. */
export async function loadLinkedTasks(actor: Actor, filter: { clientId?: string; projectId?: string }): Promise<LinkedList> {
  const r = await listTasks(actor, { view: "all", pageSize: LATEST, ...filter });
  return {
    total: r.total,
    rows: r.rows.map((t) => ({
      id: t.id,
      href: `/tasks/${t.id}`,
      title: t.title,
      subtitle: `${t.taskCode} · ${t.dueDate ? `due ${t.dueDate}` : "no due date"}`,
      status: t.status,
    })),
  };
}

/**
 * Invoices, receipts and (for projects) expenses linked to a client or project. Each list appears
 * only when the viewer has that finance permission; `null` means "not shown".
 */
export async function loadLinkedFinance(
  actor: Actor,
  filter: { clientId?: string; projectId?: string },
  opts: { expenses?: boolean } = {},
): Promise<{ invoices: LinkedList | null; receipts: LinkedList | null; expenses: LinkedList | null }> {
  const page = { page: 1, pageSize: LATEST };

  const invoices = can(actor, "finance.invoices.read")
    ? await safe(async () => {
        const r = await listInvoices(actor, { ...page, ...filter });
        return {
          total: r.total,
          rows: r.rows.map((i) => ({
            id: i.id,
            href: `/invoices/${i.id}`,
            title: i.invoiceNumber ?? "Draft invoice",
            subtitle: i.dueDate ? `due ${i.dueDate}` : "no due date",
            status: i.status,
            amount: money(i.currency, i.total),
          })),
        };
      })
    : null;

  const receipts = can(actor, "finance.payments.read")
    ? await safe(async () => {
        const r = await listReceipts(actor, { ...page, ...filter });
        return {
          total: r.total,
          rows: r.rows.map((p) => ({
            id: p.id,
            href: `/payments/${p.id}`,
            title: `Receipt for ${p.invoiceNumber ?? "a draft invoice"}`,
            subtitle: `${p.paymentDate} · ${p.method.replace("_", " ")}`,
            status: p.status,
            amount: money(p.currency, p.amount),
          })),
        };
      })
    : null;

  const expenses =
    opts.expenses && filter.projectId && can(actor, "finance.expenses.read")
      ? await safe(async () => {
          const r = await listExpenses(actor, { ...page, projectId: filter.projectId });
          return {
            total: r.total,
            rows: r.rows.map((e) => ({
              id: e.id,
              href: `/expenses/${e.id}`,
              title: `${e.expenseCode} · ${e.payee}`,
              subtitle: e.expenseDate,
              status: e.status,
              amount: money(e.currency, e.total),
            })),
          };
        })
      : null;

  return { invoices, receipts, expenses };
}
