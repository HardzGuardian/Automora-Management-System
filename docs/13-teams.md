# Departments and teams

Company → Department (Marketing, Software Development) → Team (A, B, C, D) → members.

- **Tables:** `departments`, `teams`, `team_members` (role `lead` or `member`), `task_teams`, `project_teams`.
  `task_assignees.via_team_id` and `project_members.via_team_id` mark rows that exist only because a team was assigned.
- **Live assignment:** assigning a task or project to a team gives it to every active member. When someone joins the team they get the
  team's open tasks and live projects; when they leave, they lose only the team-sourced rows. Direct assignments, project owners and
  finished (Completed or archived) tasks are never touched. Implemented by `syncTaskTeams` / `syncProjectTeams`, called from the same
  transaction as the change.
- **Because members are real assignees**, dashboards, My tasks, workload, calendar, notifications and reports needed no change.
- **Permissions:** `teams.manage` creates departments/teams and edits membership; `teams.read` lists every team (without it you see only
  your own teams). Assigning work needs `tasks.assign` / `projects.members.manage`, **or** being that team's lead (own team only, and only
  for work the lead can already see).
- **A person may be on several teams.** A team-sourced assignee cannot be removed by hand (CONFLICT); remove the team or the member.
- **Archiving a team** removes the team-sourced access it gave. Archiving a department needs it to have no live teams.
- Code: `src/modules/teams`, `src/modules/tasks/team-assignment.ts`, `src/modules/projects/team-assignment.ts`, `src/lib/team-access.ts`,
  UI under `src/app/(workspace)/teams` and `src/components/teams`. Tests: `src/modules/teams/teams.test.ts` (written, not yet run).
