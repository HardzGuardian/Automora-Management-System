# Deployment and operations runbook

Covers D3 U-09, U-28, U-33 and acceptance AC-14 (backup and restore). Status of each item is stated honestly at the end.

## 1. What runs where
| Piece | How |
|---|---|
| App | Docker image from the root `Dockerfile` (Next.js standalone, non-root user, health check on `/api/health`) |
| Database | PostgreSQL 17+ (managed service recommended). The app needs only `DATABASE_URL` |
| File storage | `STORAGE_DRIVER=s3` + `S3_*` (any S3-compatible bucket, private). Local disk (`local`) is for development only |
| Email | SMTP (`SMTP_URL`, `EMAIL_FROM`); sending failures never fail a request |
| Scheduler | Any cron/scheduler calling the two endpoints in section 5 |

## 2. Environment variables
See `.env.example`. Required in production: `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ random chars), `BETTER_AUTH_URL`, `APP_URL` (both the public https URL), `CRON_SECRET` (16+ random chars; **cron endpoints are disabled while it is empty/short**), `STORAGE_DRIVER=s3` and the `S3_*` values, `SMTP_URL`, `EMAIL_FROM`. Never commit real values.

Generate secrets: `openssl rand -base64 48`.

## 3. First deployment
1. Provision PostgreSQL and the bucket (private; block public access).
2. Build: `docker build -t automora .`
3. Migrate: `docker build --target migrate -t automora-migrate . && docker run --rm -e DATABASE_URL=... automora-migrate`
4. Seed (once): the same image, `pnpm db:seed` with `SEED_ADMIN_EMAIL` set. It prints/emails a one-time Super Admin invitation link. `SEED_DEMO` must be `false`.
5. Run: `docker run -d -p 3000:3000 --env-file prod.env automora` behind HTTPS (the app sends HSTS and a strict CSP).
6. Verify: `GET /api/health` returns `{"status":"ok"}`; open the invitation link and set the admin password; sign in.

## 4. Releases and rollback
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit/integration tests, build, and the browser suite.
- Deploy order: **migrate first, then new app version**. Migrations are additive; never edit a merged migration.
- Rollback: redeploy the previous image. If a migration must be undone, restore from backup (section 6) or write a forward fix migration.

## 5. Scheduled jobs
| Endpoint | Schedule | Does |
|---|---|---|
| `GET /api/cron/reminders` | daily, early morning company time | task due-soon/overdue, project deadlines, invoice due/overdue |
| `GET /api/cron/invoice-due` | optional, daily | invoice reminders only |

Call with `Authorization: Bearer $CRON_SECRET`. Response `200` = all good, `207` = some company/section failed (listed in the body and logged) — the next run retries automatically. Running twice never duplicates notifications (stable event keys).

Example: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/reminders`

## 6. Backup and restore (AC-14)
- **Backup:** `DATABASE_URL=... ./scripts/backup.sh /secure/backups` (custom-format dump; verifies the archive is readable). Schedule it at least daily and copy off-host. Also enable provider point-in-time recovery if available. Bucket versioning is recommended for uploaded files.
- **Restore drill:** `SOURCE_URL=... ADMIN_URL=postgres://.../postgres ./scripts/restore-check.sh backup.dump` restores into a throwaway database and compares the row count of every table with the source.
- **Real restore:** create an empty database, `pg_restore --no-owner --no-privileges --dbname=<new url> backup.dump`, point `DATABASE_URL` at it, run `/api/health`.
- **Targets (open business decision #10):** proposed RPO 24 h, RTO 4 h until the business decides.
- **Drill record:** 2026-11-13, local PostgreSQL 18, 122,589-byte dump of the seeded test database restored into a scratch database; every table's row count matched ("RESTORE OK"). A production-sized drill with the team is still to be done.

## 7. Monitoring and incident basics
- Uptime monitor on `/api/health` (503 = database unreachable).
- Application errors are logged to stdout with a reference digest shown to the user; ship container logs to your log service.
- Suspected account compromise: Settings → Employees → Suspend (revokes sessions), then reset the password. Audit trail: `activity_logs` (append-only).
- Security headers/CSP: `next.config.ts`. CSP allows inline scripts/styles because Next.js needs them; tightening to nonces is a future hardening item.

## 8. Honest status
| Item | Status |
|---|---|
| Dockerfile | Written following Next.js standalone output; **not built or run here (no Docker on the development machine)** |
| Staging deployment | **Not done** (needs hosting decision, open decision #1) |
| Health check, headers, error pages | Implemented and exercised by the browser suite |
| Backup + restore | Scripts written and drilled locally (section 6) |
| Rate limiting | Login/reset rate limits are in-memory (per instance); use database storage before running several instances |
