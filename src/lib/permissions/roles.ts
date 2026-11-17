import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, type PermissionKey } from "./catalog";

// Default role seed (docs/02-contracts.md §2). Only this file changes if the
// "manager finance access" decision (open decision #6) changes.
export const SYSTEM_ROLES: Readonly<Record<"Super Admin" | "Manager" | "Employee", readonly PermissionKey[]>> =
  {
    "Super Admin": ALL_PERMISSION_KEYS,
    Manager: [
      ...PERMISSION_GROUPS.work,
      "reports.limited.read",
      "dashboard.operational.read",
      "dashboard.personal.read",
    ],
    Employee: [
      "tasks.status.update.own",
      "tasks.comment",
      "tasks.attach",
      "dashboard.personal.read",
      "reports.personal.read",
    ],
  };
