# Developer 2 — Chintan: Finance & Business Logic

Final deliverable: fully working finance module — invoices, receipts, expenses, outgoing payments, reports — where every balance is derived from confirmed transactions and reconciles.

Read first: `00-architecture.md` (ADR-04, 05, 09, 13), `02-contracts.md`. Blueprint sections: §4.6, §5.4–5.5, §6.3–6.4, §7, §8.4, §10.2, §11, §12 (AC-08…AC-11).

Your work starts independent of auth: Sprint 1 is **pure calculation code and schema design**. Real services start once Sagar's `getActor`/`requirePermission`/`audit.record` land (end of Sprint 1).

## Principles (non-negotiable, from blueprint §7)
1. Balances are **derived**, never typed in or stored as editable totals.
2. Only **confirmed, non-reversed** payments count. Pending/unverified do not.
3. **Never edit a confirmed payment amount.** Reverse it (with reason), then record a corrected one.
4. Draft invoices are not receivables. Cancelled invoices accept no receipts.
5. Overpayment is blocked (V1 default) — no silent credit.
6. All money math on integer minor units (ADR-05); one rounding rule; positive amounts only.
7. Every money mutation: one DB transaction, row locking where needed, idempotency key, audit event in the same transaction.
8. Finance data is invisible to employee sessions — API, record and attachment level.

## Task list

### Sprint 1 — Pure logic (no DB, no auth)
| ID | Task | Done when |
|---|---|---|
| F-01 | **`lib/money`**: `toMinor/fromMinor`, add/sub/mul by quantity and rate, half-up rounding to 2 dp, `formatMoney`, reject floats/NaN/negatives where invalid | Table-driven tests incl. `0.1+0.2`, large values, rounding ties |
| F-02 | **Invoice calculation** (`calc.ts`): line total = qty × unit price − discount, then tax; invoice subtotal/discount/tax/total; rounding policy documented (per line vs per invoice — decide with accountant, default per line) | Matches hand-calculated cases |
| F-03 | **Balance calculation**: `outstanding = max(total − confirmedReceipts, 0)`; invoice status derivation from (state, total, confirmed, dueDate, today) | AC-08/AC-09 example as a unit test: 50,000 → 20,000 + 15,000 → 15,000 outstanding; reverse 15,000 → 30,000 |
| F-04 | **Expense balance & status** equivalents | |
| F-05 | **State machines**: invoice (Draft→Issued→Partially Paid→Paid, Issued/Partially Paid→Overdue (derived), Draft/Issued→Cancelled) and payment/expense-payment (Pending→Confirmed→Reversed); illegal transitions throw | Test every pair |
| F-06 | Choose PDF approach and write a 1-page note in `docs/decisions.md` | |

### Sprint 2 — Schema
| ID | Task | Done when |
|---|---|---|
| F-07 | **`db/schema/finance.ts`**: invoices, invoice_items, payments, payment_allocations, expense_categories, expenses, expense_payments, expense_attachments, idempotency_keys. `NUMERIC(14,2)`, CHECK `> 0`, composite company FKs to Sagar's clients/projects, unique `(company_id, invoice_number)`, `(company_id, expense_code)`, unique `(company_id, idempotency_key)`, indexes from §6.4 (invoice due_date, payments invoice_id) | Migration + integration tests of the constraints |
| F-08 | Finance permission keys reviewed with team; categories seed (default expense categories) | `02-contracts.md` updated |

### Sprint 3 — Invoices (draft stage)
| ID | Task | Done when |
|---|---|---|
| F-09 | Invoice service: create draft, update draft (only while Draft), line items add/edit/remove, totals recomputed server-side from items (never trust client totals), client must exist in company, optional project must belong to the same client | Permission + scope tests |
| F-10 | Numbering: assigned **at issue** (not draft) using `nextCode` and the agreed format; gap-free requirement noted for accountant | Concurrent-issue test: no duplicates |
| F-11 | Invoice list/detail queries with filters (status, client, project, date range), server pagination | |

### Sprint 4 — Incoming payments
| ID | Task | Done when |
|---|---|---|
| F-12 | `recordReceipt`: amount, date, method, reference, notes, idempotency key; created Pending or Confirmed per permission; `SELECT … FOR UPDATE` on the invoice row inside the transaction | AC-10: duplicate submit returns the original, creates no second row |
| F-13 | `confirmReceipt`: only then affects balances; recalculates invoice status (Issued→Partially Paid→Paid); over-payment rejected | AC-08 |
| F-14 | `reverseReceipt`: reason required, sets reversed state/time/actor, recalculates; original row remains | AC-09 incl. audit trail |
| F-15 | Allocation (`payment_allocations`): V1 allocates a receipt to one invoice; table shaped to allow many later | |
| F-16 | Cancelled/Draft invoice refuses receipts | Tests |
| F-17 | Client outstanding balance query (for Sagar's client detail) | `getClientFinanceSummary` |

### Sprint 5 — Expenses
| ID | Task | Done when |
|---|---|---|
| F-18 | Expense categories CRUD (activate/deactivate, not delete) | |
| F-19 | Expense CRUD: code, category, payee/vendor, description, project link (optional), expense date, due date, total, status; edit locked once payments exist | |
| F-20 | Receipt/bill attachments through `lib/storage` (Sagar); downloads require `finance.expenses.read`; employees get nothing | AC-03 finance side |

### Sprint 6 — Issue / cancel / PDF
| ID | Task | Done when |
|---|---|---|
| F-21 | `issueInvoice`: validates totals, due date, client; assigns number; becomes receivable; audit event | |
| F-22 | `cancelInvoice`: rules — no confirmed receipts (or require reversal first); reason; audit | |
| F-23 | Printable **invoice PDF** (company details, items, tax, totals, balance) via `/api/invoices/[id]/pdf`, permission-checked, same numbers as the detail page | Snapshot/number test |
| F-24 | Invoice and receipt screens (list/detail/forms) — with Shubhangi's components | Idempotency key generated when the form opens; no optimistic success |
| F-25 | Overdue invoice derivation (due date < company-local today and balance > 0) — uses Sagar's `todayInTz` | |

### Sprint 7 — Outgoing payments
| ID | Task | Done when |
|---|---|---|
| F-26 | `recordExpensePayment` (full/partial), confirm, reverse, idempotency, row lock | AC-11 |
| F-27 | Expense outstanding & status (Unpaid/Partially Paid/Paid) | |
| F-28 | Expense screens (list/detail/payment dialogs) | |
| F-29 | Project finance summary: cash-based net = project receipts − project expense payments, labelled cash-based | `getProjectFinanceSummary` |

### Sprint 8 — Financial reports
| ID | Task | Done when |
|---|---|---|
| F-30 | Queries: total invoices, total confirmed receipts, outstanding receivables, total expenses, period receipts (by payment date), period outflow (by payment date), net cash movement, receivables report, expense register, cash movement, project finance | Each has a reconciliation test against raw rows |
| F-31 | `getFinanceSnapshot(actor, range)` for the dashboard, with period-total vs point-in-time labelling | Shubhangi consumes |
| F-32 | Finance report exports use the same filters/scope; exports are audited | |

### Sprint 9 — Hardening
| ID | Task |
|---|---|
| F-33 | Edge-case suite: over-payment, exact payment, zero-tax, 100% discount, rounding ties, two simultaneous receipts on one invoice, reverse then re-record, cancelled invoice, reversed payment in a closed period |
| F-34 | Audit coverage check: invoice issue/cancel, receipt confirm/reverse, expense payment/reverse, finance export are all audited |
| F-35 | Permission pass: employee and manager-without-grant get NOT_FOUND/FORBIDDEN on every finance route, API and file |

## Acceptance tests you own
AC-08 · AC-09 · AC-10 · AC-11 · AC-03 (finance side) · finance numbers in AC-12.

## Decisions you need answered (see `00-architecture.md` open list)
Invoice number format, tax rules/rounding, credit notes/refunds in V1 (default: no), payment methods and required references, expense approval workflow (default: none), manager finance permissions (default: none). Until answered, build to the defaults and keep each rule in one place so changing it is a one-file edit; record the final answer in `docs/decisions.md`.

## Risks
1. **Float or string math on money** anywhere → wrong balances. Only `lib/money`.
2. **Concurrency**: two receipts on the same invoice both pass the over-payment check. Lock the invoice row (`FOR UPDATE`) and re-derive inside the transaction.
3. **Status stored vs derived**: store the explicit lifecycle (Draft/Issued/Cancelled) and derive Partially Paid/Paid/Overdue from confirmed payments, or store a cache and recompute inside the same transaction — pick one, document it in `decisions.md`, and never let them disagree.
4. **Reports that don't reconcile** with detail screens — each report is tested against source rows for the same range.
