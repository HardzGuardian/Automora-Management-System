# Query performance notes (D1-31)

Measured on a developer machine with PostgreSQL 18, **10,000 tasks / 200 employees / ~10,000 assignments in one company**, after `ANALYZE`. Times are `EXPLAIN (ANALYZE)` execution times.

| Query | Plan | Time |
|---|---|---|
| All tasks, default sort (`company_id`, not archived, `ORDER BY due_date`, `LIMIT 25`) | Index scan `tasks_company_due_idx` + incremental sort | 0.3 ms |
| Overdue (`due_date < today`, not completed, not archived) | Bitmap scan on `tasks_company_due_idx` | 1.0 ms |
| My Tasks (assignee `EXISTS`) | Bitmap scan `task_assignees_employee_idx` → PK lookups | 0.6 ms |
| Employee workload aggregate | same join shape | 0.2 ms |
| Status + priority filter | Bitmap scan `tasks_company_status_idx` | 1.2 ms |
| Title/code search (`ILIKE '%…%'`) | Index scan on company/due, filter | 3.9 ms |
| Pagination `COUNT(*)` for a company | Seq scan | 1.8 ms |

**Conclusion:** no new indexes were needed at this scale. `src/modules/tasks/performance.test.ts` seeds 10k rows and asserts correctness plus a generous (750 ms) bound per query so a regression such as a lost index or an N+1 shows up in CI.

## Where it will bend (not needed now)
- `COUNT(*)` for pagination and `ILIKE '%…%'` search scan linearly. Around 100k+ tasks per company, add `pg_trgm` GIN indexes on `tasks.title` / `tasks.task_code` and consider a partial index `WHERE archived_at IS NULL`.
- The company-wide list orders by `due_date`; sorting by priority or status must sort the filtered set (fine at 10k).
- Dashboards (Shubhangi) should reuse `listTasks` / `getWorkload` / `overdueCondition` rather than writing new aggregates; if a dashboard aggregates across the whole company, run `EXPLAIN` first.
