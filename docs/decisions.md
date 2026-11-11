# Decision Log

Required before implementing any change to **permission rules, financial calculations or data relationships** (blueprint v1.0 header). Add a row via PR; newest first.

| Date | Decision | Owner | Why | Status |
|---|---|---|---|---|
| 2026-11-11 | Reject decimal amount, quantity, and tax-rate strings longer than 128 characters in pure calculation helpers. | Chintan | Bounds parsing and BigInt work on untrusted input; values within the documented numeric precision remain supported. | Accepted |
| 2026-11-11 | Persist invoice lifecycle only (`draft`, `issued`, `cancelled`); derive `partially_paid`, `paid`, and `overdue` from confirmed non-reversed receipts and business dates. | Chintan | Prevents stored payment status from drifting from the source transactions; matches the balance calculation and avoids a status cache. | Accepted |
| 2026-11-11 | Generate invoice PDFs server-side with `@react-pdf/renderer`. | Chintan | Use the renderer's document primitives and avoid operating a browser process for each export. | Accepted; implement in F-23 |
| 2026-11-11 | Invoice calculations use exclusive tax; calculate and half-up round tax per line from each line's taxable amount. Line discounts are fixed currency amounts. | Chintan | Applies the architecture's GST default and keeps invoice totals as the sum of rounded line amounts; discount follows the planned monetary `discount` field. | Default applied; confirm with accountant |
| 2026-11-11 | Keep blueprint stack: Next.js + TypeScript + PostgreSQL + Drizzle (not MongoDB/Express MERN) | Sagar | Blueprint-fixed; finance needs relational constraints and transactions | Accepted |
| 2026-11-11 | Better Auth for identity/sessions; own RBAC tables for authorisation | Sagar | DB sessions + revocation; Auth.js is in maintenance mode | **Proposed — confirm** |
| 2026-11-11 | Money as integer minor units in code, `NUMERIC(14,2)` in DB, single half-up rounding helper | Chintan | Avoid float errors | Proposed |
| 2026-11-11 | Blueprint PDF not stored in the public repo | Sagar | Marked confidential/internal | Accepted |

## Open business decisions
See the table at the end of [00-architecture.md](00-architecture.md) (hosting, email provider, invoice numbering, GST, manager finance access, expense approval, payment methods, file limits, Blocked status, backup RPO/RTO). Record each answer here when made.

## F-06 — Invoice PDF approach

Use `@react-pdf/renderer` to produce invoice PDFs on the server. Its React document components fit a structured invoice (company and client details, line items, tax, totals, and balance) without launching a headless browser. HTML-to-PDF would reuse web markup, but it introduces a browser runtime and its deployment and resource requirements for a document that has a fixed print layout.

The F-23 Route Handler will authenticate the request, check `finance.invoices.read`, load the invoice through the caller's company scope, and render from the same calculated invoice values used by the detail view. It must not accept client-submitted totals or expose a PDF before authorization succeeds. The renderer is an explicitly listed ADR-14 candidate, so it does not change the stack; pin its exact version when F-23 adds the dependency and verify it in the production build environment.
