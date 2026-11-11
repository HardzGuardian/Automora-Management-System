# Decision Log

Required before implementing any change to **permission rules, financial calculations or data relationships** (blueprint v1.0 header). Add a row via PR; newest first.

| Date | Decision | Owner | Why | Status |
|---|---|---|---|---|
| 2026-11-11 | Invoice calculations use exclusive tax; calculate and half-up round tax per line from each line's taxable amount. Line discounts are fixed currency amounts. | Chintan | Applies the architecture's GST default and keeps invoice totals as the sum of rounded line amounts; discount follows the planned monetary `discount` field. | Default applied; confirm with accountant |
| 2026-11-11 | Keep blueprint stack: Next.js + TypeScript + PostgreSQL + Drizzle (not MongoDB/Express MERN) | Sagar | Blueprint-fixed; finance needs relational constraints and transactions | Accepted |
| 2026-11-11 | Better Auth for identity/sessions; own RBAC tables for authorisation | Sagar | DB sessions + revocation; Auth.js is in maintenance mode | **Proposed — confirm** |
| 2026-11-11 | Money as integer minor units in code, `NUMERIC(14,2)` in DB, single half-up rounding helper | Chintan | Avoid float errors | Proposed |
| 2026-11-11 | Blueprint PDF not stored in the public repo | Sagar | Marked confidential/internal | Accepted |

## Open business decisions
See the table at the end of [00-architecture.md](00-architecture.md) (hosting, email provider, invoice numbering, GST, manager finance access, expense approval, payment methods, file limits, Blocked status, backup RPO/RTO). Record each answer here when made.
