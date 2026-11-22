import { describe, expect, it } from "vitest";
import { NAV, isActive, visibleNav } from "./nav";

const labels = (perms: string[]) => visibleNav(new Set(perms)).main.map((i) => i.label);

describe("visibleNav", () => {
  it("is one flat list with Settings kept apart, and no bell or account entries (they are in the top bar)", () => {
    const hrefs = NAV.map((i) => i.href);
    expect(hrefs).not.toContain("/notifications");
    expect(hrefs).not.toContain("/profile");
    expect(hrefs).not.toContain("/settings");
  });

  it("shows a plain employee the universal screens only", () => {
    expect(labels([])).toEqual(["Dashboard", "Projects", "Tasks", "Documents", "Team"]);
    expect(visibleNav(new Set()).settings).toBeNull();
  });

  it("shows Clients and Finance (which includes Reports) by permission", () => {
    expect(labels(["clients.read"])).toContain("Clients");
    expect(labels(["employees.read"])).toContain("Employees");
    expect(labels([])).not.toContain("Employees");
    expect(labels(["clients.read"])).not.toContain("Finance");
    expect(labels(["finance.expenses.read"])).toContain("Finance");
    expect(labels(["finance.reports.read"])).toContain("Finance");
    expect(labels(["reports.personal.read"])).toContain("Reports"); // report access alone shows as Reports
    expect(labels(["reports.personal.read"])).not.toContain("Finance");
  });

  it("shows Settings for settings, roles, users or the security log", () => {
    for (const p of ["settings.read", "roles.read", "users.read", "audit.read"]) expect(visibleNav(new Set([p])).settings?.label).toBe("Settings");
  });

  it("shows everything for a user with every permission", () => {
    const all = NAV.flatMap((i) => i.anyOf ?? []);
    expect(labels(all)).toHaveLength(NAV.length);
  });
});

describe("isActive", () => {
  const finance = NAV.find((i) => i.label === "Finance")!;
  const tasks = NAV.find((i) => i.label === "Tasks")!;
  it("matches the section itself and its child pages", () => {
    expect(isActive(tasks, "/tasks")).toBe(true);
    expect(isActive(tasks, "/tasks/new")).toBe(true);
    expect(isActive(tasks, "/projects")).toBe(false);
  });
  it("treats the finance lists and old My tasks as part of their sections", () => {
    for (const p of ["/finance", "/invoices", "/invoices/abc", "/payments", "/expenses/new", "/finance-reports", "/reports"]) expect(isActive(finance, p)).toBe(true);
    expect(isActive(tasks, "/my-tasks")).toBe(true);
  });
  it("does not match a path that only starts with the same letters", () => {
    expect(isActive(tasks, "/tasksforce")).toBe(false);
  });
});
