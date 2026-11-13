import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { getActor } from "@/lib/auth/actor";
import { listExpenseCategories, listExpenses } from "@/modules/finance";
import { money } from "../invoices/_components/finance-ui";
import { parsePage } from "@/lib/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Expenses" };

const PAGE_SIZE = 25;
const STATUSES = ["unpaid", "partially_paid", "paid"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS: DataColumn[] = [
  { key: "expenseCode", header: "Code", kind: "link", href: "/expenses/{id}" },
  { key: "payee", header: "Payee" },
  { key: "categoryName", header: "Category" },
  { key: "expenseDate", header: "Date" },
  { key: "status", header: "Status", kind: "status" },
  { key: "total", header: "Total", kind: "number" },
  { key: "outstanding", header: "Outstanding", kind: "number" },
];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; categoryId?: string }> }) {
  const actor = await getActor();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const status = STATUSES.find((s) => s === sp.status);
  const categoryId = sp.categoryId && UUID.test(sp.categoryId) ? sp.categoryId : undefined;
  const canCreate = actor.permissions.has("finance.expenses.create");
  const [result, categories] = await Promise.all([
    listExpenses(actor, { page, pageSize: PAGE_SIZE, status, categoryId }),
    listExpenseCategories(actor, true).catch(() => []),
  ]);
  const filtered = Boolean(status || categoryId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Expenses"
        description="Money the company owes or has paid out. Payments count toward an expense only once confirmed."
        actions={canCreate ? <Link href="/expenses/new" className={buttonClass("primary")}>Create expense</Link> : null}
      />
      <FilterBar label="Filter expenses">
        <select aria-label="Status" name="status" defaultValue={status ?? ""} className={`${inputClass} w-44`}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        {categories.length > 0 ? (
          <select aria-label="Category" name="categoryId" defaultValue={categoryId ?? ""} className={`${inputClass} w-56`}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
        ) : null}
      </FilterBar>
      <DataTable
        caption="Expenses"
        columns={COLUMNS}
        rows={result.rows.map((expense) => ({
          id: expense.id,
          expenseCode: expense.expenseCode,
          payee: expense.payee,
          categoryName: expense.categoryName,
          expenseDate: expense.expenseDate,
          status: expense.status,
          total: money(expense.currency, expense.total),
          outstanding: money(expense.currency, expense.outstanding),
        }))}
        total={result.total}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/expenses"
        params={{ status, categoryId }}
        emptyTitle={filtered ? "No expenses match" : "No expenses recorded yet"}
        emptyDescription={filtered ? "Try a different status or category." : "Record an expense to track what you owe and what you have paid."}
        emptyAction={canCreate && !filtered ? { href: "/expenses/new", label: "Create expense" } : undefined}
      />
    </div>
  );
}
