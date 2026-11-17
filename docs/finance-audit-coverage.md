# Finance audit coverage

Checked against the finance service implementations for F-34 on 2026-11-11.

| Operation | Audit action | Implementation | Atomicity |
|---|---|---|---|
| Issue invoice | `invoice.issued` | `src/modules/finance/invoices/service.ts` — `issueInvoice` | Audit is written with the invoice update in the same transaction. |
| Cancel invoice | `invoice.cancelled` | `src/modules/finance/invoices/service.ts` — `cancelInvoice` | Audit is written with the invoice update in the same transaction. |
| Confirm receipt | `payment.confirmed` | `src/modules/finance/payments/service.ts` — `confirmReceipt` | Audit is written with the confirmation in the same transaction. |
| Reverse receipt | `payment.reversed` | `src/modules/finance/payments/service.ts` — `reverseReceipt` | Audit is written with the reversal in the same transaction. |
| Record expense payment | `expense_payment.recorded` | `src/modules/finance/expense-payments/service.ts` — `recordExpensePayment` | Audit is written with the idempotent payment creation in the same transaction. |
| Confirm expense payment | `expense_payment.confirmed` | `src/modules/finance/expense-payments/service.ts` — `confirmExpensePayment` | Audit is written with the confirmation in the same transaction. |
| Reverse expense payment | `expense_payment.reversed` | `src/modules/finance/expense-payments/service.ts` — `reverseExpensePayment` | Audit is written with the reversal in the same transaction. |
| Export finance report | `finance.report.exported` | `src/modules/finance/reports/export.ts` — `exportFinanceReport` | Generated export metadata is audited before handing the response to the stream adapter. This is read-only and has no business row mutation to share a transaction with. |

This is a source coverage check. End-to-end verification that audit rows persist requires the shared audit/database scaffold and a PostgreSQL test database, which are not present in this checkout.
