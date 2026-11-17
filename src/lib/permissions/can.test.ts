import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors/domain-error";
import { PERMISSIONS, type PermissionKey } from "./catalog";
import { can } from "./can";
import { requirePermission } from "./require";
import { SYSTEM_ROLES } from "./roles";

const actor = (perms: PermissionKey[]): Actor => ({
  userId: "u1",
  companyId: "c1",
  employeeId: null,
  roles: [],
  permissions: new Set(perms),
  timezone: "Asia/Kolkata",
});

const ALL = Object.values(PERMISSIONS);

describe("can / requirePermission", () => {
  it("denies every key when the permission set is empty (deny by default)", () => {
    const a = actor([]);
    for (const key of ALL) expect(can(a, key)).toBe(false);
  });

  it("allows exactly the granted key", () => {
    const a = actor(["tasks.create"]);
    expect(can(a, "tasks.create")).toBe(true);
    expect(can(a, "tasks.update")).toBe(false);
  });

  it("requirePermission throws FORBIDDEN when missing", () => {
    expect(() => requirePermission(actor([]), "tasks.create")).toThrow(DomainError);
    try {
      requirePermission(actor([]), "tasks.create");
    } catch (e) {
      expect((e as DomainError).code).toBe("FORBIDDEN");
    }
    expect(() => requirePermission(actor(["tasks.create"]), "tasks.create")).not.toThrow();
  });
});

describe("system role defaults", () => {
  it("catalogue has no duplicate keys", () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it("Super Admin has every key", () => {
    expect([...SYSTEM_ROLES["Super Admin"]].sort()).toEqual([...ALL].sort());
  });

  it("Manager has no finance, users or roles keys and no settings.manage", () => {
    const m = SYSTEM_ROLES.Manager;
    expect(m.some((k) => k.startsWith("finance."))).toBe(false);
    expect(m.some((k) => k.startsWith("users.") || k.startsWith("roles."))).toBe(false);
    expect(m).not.toContain("settings.manage");
    expect(m).toContain("tasks.assign");
    expect(m).toContain("employees.read");
  });

  it("Employee has exactly the five employee-level keys", () => {
    expect([...SYSTEM_ROLES.Employee].sort()).toEqual(
      [
        "dashboard.personal.read",
        "reports.personal.read",
        "tasks.attach",
        "tasks.comment",
        "tasks.status.update.own",
      ].sort(),
    );
  });
});
