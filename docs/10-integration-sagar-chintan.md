# Integration: Sagar's foundation + Chintan's finance module

Date: 2026-11-11. Branch `integration/sagar-plus-chintan` = Sagar's work merged with `origin/Chintan`.
Result: lint 0 errors, typecheck clean, `next build` passes, **all tests pass** (Sagar's + Chintan's + `src/test/finance-integration.test.ts`, which runs Chintan's services end-to-end against the real database).

Chintan's branch was written against `main` (docs only), so it could not be compiled or run against the shared foundation. Everything below was found by doing that.

## Foundation-side changes (Sagar's)
| Change | Why |
|---|---|
| `src/db/schema/index.ts` exports `./finance` | Finance modules import their tables from `@/db/schema` |
| `ErrorCode` also allows `<ENTITY>_NOT_FOUND`; new `isNotFound(code)` | Finance uses `INVOICE_NOT_FOUND`, `PAYMENT_NOT_FOUND`, … (contracts §3 allows entity-specific codes) |
| `tsconfig` target `ES2022` | `lib/money` uses BigInt literals |
| `nextSequence(tx, companyId, kind)` returns the raw number; `nextCode` formats it | Finance formats its own numbers (`INV-2026-000001`); kinds are the shared `INV` / `EXP`, not `"invoice"` / `"expense"` |
| `@react-pdf/renderer@4.9.0` added | Chintan's F-06 decision for invoice PDFs |
| Migration `0002_*` for the finance tables | Generated after the schema export |
| D1-30: finance sections on client and project pages | Shown only with finance permissions; a finance error never breaks the page |

## Changes inside Chintan's files — **please review**
1. **`schema/finance.ts`: 8 columns `uuid` → `text`** (`created_by`, `updated_by`, `confirmed_by`, `reversed_by`). They reference Better Auth's `user.id`, which is `text`. With `uuid` the finance migration cannot be applied at all.
2. **`expense-payments/service.ts` `confirmExpensePayment`** called `getConfirmedExpensePayments`, which no longer exists after the "reserve balance for pending payments" refactor → `ReferenceError` on every confirmation. Now uses `getExpensePaymentReservations(...).confirmed`. Regression test added.
3. **`summaries.ts` `getClientFinanceSummary`**: the computed `outstanding` column of the subquery had no alias, so Drizzle threw on every call. Added `.as("outstanding")`.
4. `invoices/numbering.ts`, `expenses/numbering.ts`: call `nextSequence(tx, companyId, "INV" | "EXP")`.
5. `expenses/queries.ts`: removed a duplicated `total` key (the spread already overrode it, so runtime behaviour is unchanged).
6. `finance/index.ts` re-exports `FinanceExportRequest` from `reports/schemas`; `reports/project-finance.ts` re-exports `ProjectFinanceCurrencySummary` from `cash-movement-math` (wrong source module before).
7. `api/invoices/[id]/pdf/route.ts`: `renderToBuffer(InvoicePdfDocument({ data }))` (type-correct for react-pdf).

## Still open (not solved by this merge)
- **Receipts download route:** add a finance `FileAccessChecker` to `CHECKERS` in `src/app/api/files/[id]/route.ts` (Chintan's attachment adapter must be bound to `@/modules/files`' `saveUpload`).
- **Exports:** `src/app/api/exports/[report]/route.ts` and `lib/export` belong to Shubhangi and do not exist yet.
- **Lint warnings** in `expense-payments/queries.ts` (unused `count`, `sql`) and `expenses/schemas.test.ts`.
- Finance service functions have no DB-backed denied-request/IDOR tests beyond the ones in `src/test/finance-integration.test.ts`; add the rest per module.

## Merge order
`main` has no foundation, so Chintan's branch cannot stand alone. Recommended: merge Sagar's branches into `main` first, then Chintan merges/rebases `main` and takes the "Changes inside Chintan's files" above (or this integration branch is merged as-is after his review).
