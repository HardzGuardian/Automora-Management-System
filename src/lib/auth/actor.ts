import type { PermissionKey } from "@/lib/permissions/catalog";

export type Actor = {
  userId: string;
  companyId: string;
  employeeId: string | null;
  roles: string[];
  permissions: ReadonlySet<PermissionKey>;
  timezone: string;
};
