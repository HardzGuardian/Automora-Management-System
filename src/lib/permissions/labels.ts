import type { PermissionKey } from "./catalog";

/**
 * Plain-language wording for every permission, used on the roles screen. The record is typed
 * over PermissionKey, so adding a permission to the catalogue without a label fails typecheck.
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "users.read": "View users",
  "users.invite": "Invite users",
  "users.suspend": "Suspend and reactivate users",
  "roles.read": "View roles",
  "roles.manage": "Create roles and change their permissions",
  "settings.read": "View company settings",
  "settings.manage": "Change company settings",
  "audit.read": "View the audit log",
  "dashboard.company.read": "View the company dashboard",
  "dashboard.operational.read": "View the operations dashboard",
  "dashboard.personal.read": "View their own dashboard",
  "reports.all.read": "View all reports",
  "reports.limited.read": "View limited reports",
  "reports.personal.read": "View their own reports",
  "reports.export": "Export reports",

  "employees.read": "View the employee directory",
  "employees.create": "Add employees",
  "employees.update": "Edit employees",
  "employees.deactivate": "Deactivate employees",
  "employees.workload.read": "View employee workload",
  "clients.read": "View clients",
  "clients.create": "Add clients",
  "clients.update": "Edit clients",
  "clients.archive": "Archive clients",
  "projects.read.all": "View all projects",
  "projects.create": "Create projects",
  "projects.update": "Edit projects",
  "projects.archive": "Archive projects",
  "projects.members.manage": "Manage project members",
  "projects.milestones.manage": "Manage project milestones",
  "tasks.read.all": "View all tasks",
  "tasks.create": "Create tasks",
  "tasks.update": "Edit tasks",
  "tasks.assign": "Assign tasks",
  "tasks.archive": "Archive tasks",
  "tasks.bulk": "Update several tasks at once",
  "tasks.status.update.own": "Update the status of their own tasks",
  "tasks.comment": "Comment on tasks",
  "tasks.attach": "Attach files to tasks",
  "teams.read": "View all teams",
  "teams.manage": "Create teams and manage members",

  "finance.invoices.read": "View invoices",
  "finance.invoices.create": "Create invoices",
  "finance.invoices.update": "Edit draft invoices",
  "finance.invoices.issue": "Issue invoices",
  "finance.invoices.cancel": "Cancel invoices",
  "finance.payments.read": "View receipts",
  "finance.payments.record": "Record receipts",
  "finance.payments.confirm": "Confirm receipts",
  "finance.payments.reverse": "Reverse receipts",
  "finance.expenses.read": "View expenses",
  "finance.expenses.create": "Create expenses",
  "finance.expenses.update": "Edit expenses",
  "finance.expenses.pay": "Record and confirm expense payments",
  "finance.expenses.reverse": "Reverse expense payments",
  "finance.categories.manage": "Manage expense categories",
  "finance.reports.read": "View finance reports",
  "finance.reports.export": "Export finance reports",
  "finance.notifications.receive": "Receive finance notifications",
};

/** The heading a permission is listed under. Finance is split by its second segment. */
export function permissionArea(key: string): string {
  const parts = key.split(".");
  return parts[0] === "finance" ? `finance.${parts[1]}` : (parts[0] ?? key);
}

export const AREA_TITLES: Record<string, string> = {
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  audit: "Audit log",
  dashboard: "Dashboards",
  reports: "Reports",
  employees: "Employees",
  clients: "Clients",
  projects: "Projects",
  tasks: "Tasks",
  teams: "Teams",
  "finance.invoices": "Invoices",
  "finance.payments": "Receipts",
  "finance.expenses": "Expenses",
  "finance.categories": "Expense categories",
  "finance.reports": "Finance reports",
  "finance.notifications": "Finance notifications",
};
