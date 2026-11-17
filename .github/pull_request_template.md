## Task
ID: <!-- e.g. D1-05 -->

## Definition of Done
- [ ] Lint, `tsc --noEmit` (strict, no `any`), tests pass; build succeeds
- [ ] Migrations committed; `.env.example` and docs updated
- [ ] Permission check + record-scope check in the service, with an automated test for the denied case
- [ ] Loading, empty, error and success states (UI work)
- [ ] Sensitive actions write an audit event
- [ ] No unused imports, no `console.log`, no hard-coded secrets, no invented CSS classes
- [ ] Works at mobile width (if UI)
- [ ] Task checked off in `docs/progress.md`
