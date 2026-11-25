import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FieldGrid, FormView, SheetTitle, SmartButtons } from "@/components/ui/odoo";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getClient } from "@/modules/clients";
import { listInvoices, type InvoiceListRow } from "@/modules/finance";
import { getProject } from "@/modules/projects";
import { listTasks } from "@/modules/tasks";
import { money } from "../../../../invoices/_components/finance-ui";

export const metadata = { title: "Client project" };

const UNPAID = new Set<InvoiceListRow["status"]>(["issued", "partially_paid", "overdue"]);
const STATUS_TEXT: Record<InvoiceListRow["status"], string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

/** Totals per currency, in minor units (whole paise/cents) so nothing is lost to rounding. */
function totalsByCurrency(rows: InvoiceListRow[]): { currency: string; amount: string }[] {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.currency, (sums.get(r.currency) ?? 0) + toMinor(r.outstanding));
  return [...sums].map(([currency, minor]) => ({ currency, amount: fromMinor(minor) }));
}

/**
 * One client's project: what is still unpaid, every invoice raised for it, and its tasks.
 * Shown as a pop-up over the client page, or as a full page when the link is opened directly.
 */
export default async function ClientProjectPage({ params }: { params: Promise<{ id: string; projectId: string }> }) {
  const actor = await requireActor();
  const { id, projectId } = await params;
  const uuid = z.string().uuid();
  if (!uuid.safeParse(id).success || !uuid.safeParse(projectId).success) notFound();

  let client;
  let project;
  try {
    [client, project] = await Promise.all([getClient(actor, id), getProject(actor, projectId)]);
  } catch (e) {
    if (e instanceof DomainError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  // Only this client's own project: a project of another client is never shown under this one.
  if (project.clientId !== id) notFound();

  const canSeeFinance = can(actor, "finance.invoices.read");
  let invoices: InvoiceListRow[] | null = null;
  let financeUnavailable = false;
  if (canSeeFinance) {
    try {
      invoices = (await listInvoices(actor, { clientId: id, projectId, page: 1, pageSize: 100, sortBy: "dueDate", sortDirection: "asc" })).rows;
    } catch {
      financeUnavailable = true; // a finance problem must never break this view
    }
  }
  const tasks = await listTasks(actor, { view: "all", clientId: id, projectId, pageSize: 100 });

  const unpaid = (invoices ?? []).filter((i) => UNPAID.has(i.status) && toMinor(i.outstanding) > 0);
  const unpaidTotals = totalsByCurrency(unpaid);

  return (
    <FormView crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name, href: `/clients/${id}` }, { label: project.name }]}>
      <SheetTitle
        code={project.projectCode}
        title={project.name}
        badges={<StatusBadge status={project.archived ? "Archived" : project.status} />}
        smart={
          <SmartButtons
            items={[
              ...(invoices
                ? [
                    { icon: "partial" as const, value: unpaidTotals.length > 0 ? unpaidTotals.map((t) => money(t.currency, t.amount)).join(" + ") : "0", label: "Unpaid", tone: unpaid.length > 0 ? ("danger" as const) : undefined },
                    { icon: "issued" as const, value: invoices.length, label: "Invoices" },
                  ]
                : []),
              { icon: "tasks", value: tasks.total, label: "Tasks", href: `/projects/${projectId}` },
            ]}
          />
        }
      />
      <FieldGrid
        items={[
          { label: "Client", value: client.name },
          { label: "Due date", value: project.dueDate },
        ]}
      />
      <div className="mt-2 flex flex-col gap-5">

      {canSeeFinance ? (
        financeUnavailable || invoices === null ? (
          <p className="text-sm text-muted">Finance data is unavailable right now.</p>
        ) : (
          <>
            <SectionCard title="Unpaid charges" count={unpaid.length}>
              {unpaid.length === 0 ? (
                <p className="m-0 text-sm text-muted">Nothing is unpaid for this project.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <caption className="sr-only">Unpaid invoices for {project.name}</caption>
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th scope="col" className="py-2 pr-3 font-medium">Invoice</th>
                          <th scope="col" className="px-3 py-2 font-medium">Due</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Paid</th>
                          <th scope="col" className="py-2 pl-3 text-right font-medium">Unpaid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaid.map((i) => (
                          <tr key={i.id} className="border-t border-border">
                            <td className="py-2.5 pr-3">
                              <Link href={`/invoices/${i.id}`} className={linkClass}>
                                {i.invoiceNumber ?? "Draft invoice"}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-body">
                              {i.dueDate ?? "-"}
                              {i.status === "overdue" ? <span className="ml-1 font-medium text-danger">overdue</span> : null}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-body">{money(i.currency, i.total)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-body">{money(i.currency, i.confirmedReceipts)}</td>
                            <td className="py-2.5 pl-3 text-right font-medium tabular-nums text-foreground">{money(i.currency, i.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-1 border-t border-border p-0 pt-3 text-sm">
                    {unpaidTotals.map((t) => (
                      <li key={t.currency} className="flex items-center justify-between gap-3">
                        <span className="text-muted">Total unpaid</span>
                        <span className="font-semibold tabular-nums">{money(t.currency, t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Invoices"
              count={invoices.length}
              action={
                can(actor, "finance.invoices.create") ? (
                  <Link href="/invoices/new" className={buttonClass("secondary", "min-h-8 px-3 py-1")}>
                    New invoice
                  </Link>
                ) : null
              }
            >
              {invoices.length === 0 ? (
                <p className="m-0 text-sm text-muted">No invoices have been created for this project yet.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-border p-0 text-sm">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <Link href={`/invoices/${i.id}`} className={linkClass}>
                          {i.invoiceNumber ?? "Draft invoice"}
                        </Link>
                        <span className="ml-2 text-xs text-muted">{i.dueDate ? `due ${i.dueDate}` : "no due date"}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-body">{money(i.currency, i.total)}</span>
                        <span className="text-xs font-medium text-muted">{STATUS_TEXT[i.status]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        )
      ) : null}

      <SectionCard
        title="Tasks"
        count={tasks.total}
        action={
          <Link href={`/projects/${projectId}`} className={linkClass}>
            Open the full project
          </Link>
        }
      >
        {tasks.rows.length === 0 ? (
          <p className="m-0 text-sm text-muted">No tasks in this project yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0 text-sm">
            {tasks.rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <Link href={`/tasks/${t.id}`} className={linkClass}>
                    {t.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    {t.taskCode} · {t.assignees.length > 0 ? t.assignees.map((a) => a.fullName).join(", ") : "Unassigned"}
                    {t.dueDate ? ` · due ${t.dueDate}` : ""}
                  </span>
                </span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      </div>
    </FormView>
  );
}
