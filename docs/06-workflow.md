# Team Workflow

## Branches
- `main` is always deployable-to-staging. Protected: PR required, 1 approving review, CI green.
- Branch names: `sagar/d1-05-task-crud`, `chintan/f-12-receipt-reversal`, `shubhangi/u-08-kpi-cards` (developer / task ID / slug).
- Squash-merge. Delete branch after merge.

## Commits and PRs
- Conventional commits: `feat(tasks): …`, `fix(finance): …`, `test(…)`, `docs(…)`, `chore(…)`.
- One task ID per PR when possible; PRs under ~500 changed lines (excluding migrations/lockfile).
- Migrations: one logical migration per PR; never edit a merged migration. See `00-architecture.md` §4 for conflict handling.
- Reviewer: owner of the touched folder (CODEOWNERS). Cross-module changes need both owners.

## Definition of Done (blueprint §12)
- [ ] Lint, `tsc --noEmit` (strict, no `any`), tests pass; build succeeds
- [ ] Migrations committed; `.env.example` and docs updated
- [ ] Permission check + record-scope check in the service, **with an automated test for the denied case**
- [ ] Loading, empty, error and success states (UI work)
- [ ] Sensitive actions write an audit event (role/permission change, suspension, invoice issue/cancel, receipt confirm/reverse, expense payment, export of finance reports)
- [ ] No unused imports, no `console.log`, no hard-coded secrets, no invented CSS classes (Tailwind utilities or tokens defined in `globals.css`)
- [ ] Works at mobile width (if UI)
- [ ] Task checked off in `docs/progress.md`

## Tests required by type of change
| Change | Minimum tests |
|---|---|
| Service function | happy path, permission denied, out-of-scope record, validation failure |
| Money/status calculation | table-driven unit tests incl. edge cases (zero, rounding, over-payment, reversal) |
| Schema change | integration test hitting the constraint |
| Page/flow | Playwright for the main journey at desktop + mobile width |

## Security checklist for reviewers
- Does any query take `company_id` or `userId` from client input? → reject.
- Does any list/detail/file endpoint skip the scope helper? → reject.
- Any `any`, `as unknown as`, `dangerouslySetInnerHTML`, string-built SQL? → justify or reject.
- Any secret, token or password in logs, audit JSON or error messages? → reject.
- Any new dependency not listed in ADR-14? → must be justified in the PR.

## Progress tracking
`docs/progress.md` — one table per developer, task ID / status / PR link. Updated in the same PR that finishes a task. The integrator reviews it at each "I-n" point.

## Decision log
`docs/decisions.md` — date, decision, who, why. Required for any change to permission rules, financial calculations or data relationships, **before** implementation.

## Communication
- Blocked > half a day → say so in the channel; someone else may unblock via a stub.
- Don't build a private copy of something a teammate owns (money helper, date helper, table component). Ask, or open a small PR into their folder with their review.
