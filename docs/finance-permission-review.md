# Finance permission review

Source-level F-35 review on 2026-11-11. Public finance data access and mutation paths below call `requirePermission` (or, for expense category listing, allow only actors with one of the listed category/read/create grants) and include `actor.companyId` in record queries. Server actions obtain the actor from `getActor()` and delegate to these guarded services.

| Area | Required permission(s) | Scoped entry points |
|---|---|---|
| Invoice draft, issue, cancel | `finance.invoices.create`, `.update`, `.issue`, `.cancel` | `invoices/service.ts`; mutations bind company from actor and scope invoice, client, project, and item IDs. |
| Invoice list/detail/client selectors and PDF | `finance.invoices.read` (client selector uses `.create`) | `invoices/queries.ts`, `invoices/pdf.tsx`; query conditions include company. PDF route calls `getActor`, then the guarded PDF query and returns private/no-store output. |
| Receipts | `finance.payments.record`, `.confirm`, `.reverse`, `.read` | `payments/service.ts`, `payments/queries.ts`; payment and invoice rows are company-scoped. |
| Expense categories | `finance.categories.manage`; list requires manage, expense-create, or expense-read | `expenses/categories.ts`; all category queries include company. |
| Expenses and attachments | `finance.expenses.create`, `.update`, `.read` | `expenses/service.ts`, `expenses/queries.ts`, `expenses/attachments.ts`; expense, attachment, and file metadata queries include company. |
| Expense payments | `finance.expenses.pay`, `.reverse`, `.read` | `expense-payments/service.ts`, `expense-payments/queries.ts`; expense/payment IDs are company-scoped. |
| Project/client finance and reports | `finance.invoices.read` plus `finance.expenses.read`, or `finance.reports.read` | `summaries.ts`, `reports/*.ts`; records and report joins are filtered to the actor company. |
| Report export | `finance.reports.read` and `finance.reports.export` | `reports/export.ts`; it calls the same guarded, company-scoped report queries before serialization and audit. |

## Verification limits and integration work

- This checkout does not contain `src/lib/auth`, `src/lib/permissions`, `src/db`, the Drizzle schema, or a PostgreSQL test database. Therefore employee and manager-without-grant cases and cross-company IDOR cases cannot be executed end-to-end here. Source review does not substitute for those denied-request tests.
- The shared `src/lib/export` implementation and `src/app/api/exports/[report]/route.ts` are Shubhangi-owned and absent. The finance export service is ready for that adapter/route, but no HTTP export endpoint is wired in this checkout.
- Storage helpers and the shared files/download route are Sagar-owned and absent. The finance attachment adapter checks permissions and company ownership, but actual file endpoint authorization requires that integration.

F-35 remains in progress until those integration tests and shared endpoints are available; no files outside Chintan's ownership were changed.
