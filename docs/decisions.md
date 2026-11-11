# Decision Log

Required before implementing any change to **permission rules, financial calculations or data relationships** (blueprint v1.0 header). Add a row via PR; newest first.

| Date | Decision | Owner | Why | Status |
|---|---|---|---|---|
| 2026-11-11 | Next.js `cacheComponents` / `partialPrefetching` turned OFF (create-next-app defaults) | Sagar | Per-request authenticated pages would need Suspense around every cookie/header read | Proposed |
| 2026-11-11 | Added `nodemailer` for SMTP (invites/resets; Mailpit in dev) | Sagar | ADR-14 lists Mailpit but no mail client | Proposed |
| 2026-11-11 | Suspension = Better Auth `user.banned`; Better Auth `admin()` plugin enabled for ban/revoke only. Never assign `user.role = "admin"` (it would unlock Better Auth admin endpoints outside our RBAC) | Sagar | Single source of truth for authorisation is `lib/permissions` | Proposed |
| 2026-11-11 | Keep blueprint stack: Next.js + TypeScript + PostgreSQL + Drizzle (not MongoDB/Express MERN) | Sagar | Blueprint-fixed; finance needs relational constraints and transactions | Accepted |
| 2026-11-11 | Better Auth for identity/sessions; own RBAC tables for authorisation | Sagar | DB sessions + revocation; Auth.js is in maintenance mode | **Proposed — confirm** |
| 2026-11-11 | Money as integer minor units in code, `NUMERIC(14,2)` in DB, single half-up rounding helper | Chintan | Avoid float errors | Proposed |
| 2026-11-11 | Blueprint PDF not stored in the public repo | Sagar | Marked confidential/internal | Accepted |

## Open business decisions
See the table at the end of [00-architecture.md](00-architecture.md) (hosting, email provider, invoice numbering, GST, manager finance access, expense approval, payment methods, file limits, Blocked status, backup RPO/RTO). Record each answer here when made.
