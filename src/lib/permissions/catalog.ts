// Permission catalogue v1 (docs/02-contracts.md §2). Changing it needs review from all three developers.
// Format: area.resource.action. Deny by default.

export const PERMISSION_GROUPS = {
  system: [
    "users.read",
    "users.invite",
    "users.suspend",
    "roles.read",
    "roles.manage",
    "settings.read",
    "settings.manage",
    "audit.read",
    "dashboard.company.read",
    "dashboard.operational.read",
    "dashboard.personal.read",
    "reports.all.read",
    "reports.limited.read",
    "reports.personal.read",
    "reports.export",
  ],
  work: [
    "employees.read",
    "employees.create",
    "employees.update",
    "employees.deactivate",
    "employees.workload.read",
    "clients.read",
    "clients.create",
    "clients.update",
    "clients.archive",
    "projects.read.all",
    "projects.create",
    "projects.update",
    "projects.archive",
    "projects.members.manage",
    "projects.milestones.manage",
    "tasks.read.all",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "tasks.archive",
    "tasks.bulk",
    "tasks.status.update.own",
    "tasks.comment",
    "tasks.attach",
    "teams.read",
    "teams.manage",
  ],
  finance: [
    "finance.invoices.read",
    "finance.invoices.create",
    "finance.invoices.update",
    "finance.invoices.issue",
    "finance.invoices.cancel",
    "finance.payments.read",
    "finance.payments.record",
    "finance.payments.confirm",
    "finance.payments.reverse",
    "finance.expenses.read",
    "finance.expenses.create",
    "finance.expenses.update",
    "finance.expenses.pay",
    "finance.expenses.reverse",
    "finance.categories.manage",
    "finance.reports.read",
    "finance.reports.export",
    "finance.notifications.receive",
  ],
} as const;

export type PermissionKey =
  | (typeof PERMISSION_GROUPS.system)[number]
  | (typeof PERMISSION_GROUPS.work)[number]
  | (typeof PERMISSION_GROUPS.finance)[number];

export const PERMISSIONS: Readonly<Record<string, PermissionKey>> = Object.fromEntries(
  Object.values(PERMISSION_GROUPS)
    .flat()
    .map((k) => [k, k as PermissionKey]),
);

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = Object.values(PERMISSIONS);

export function groupOf(key: PermissionKey): keyof typeof PERMISSION_GROUPS {
  for (const [group, keys] of Object.entries(PERMISSION_GROUPS)) {
    if ((keys as readonly string[]).includes(key)) return group as keyof typeof PERMISSION_GROUPS;
  }
  throw new Error(`Unknown permission key: ${key}`);
}
