import { describe, expect, it } from "vitest";
import { NAV, breadcrumbs, visibleNav } from "./nav";

const labels = (perms: string[]) => visibleNav(new Set(perms)).flatMap((g) => g.items.map((i) => i.label));

describe("visibleNav", () => {
  it("shows an employee only the universal items", () => {
    expect(labels([])).toEqual(["Dashboard", "My tasks", "All tasks", "Projects", "Notifications", "My account"]);
  });
  it("hides the whole Finance group without finance permissions", () => {
    expect(visibleNav(new Set(["clients.read"])).map((g) => g.label)).not.toContain("Finance");
  });
  it("shows finance items one by one by permission", () => {
    expect(labels(["finance.invoices.read"])).toContain("Invoices");
    expect(labels(["finance.invoices.read"])).not.toContain("Payments");
  });
  it("shows Reports for any report scope and Settings for roles.read", () => {
    expect(labels(["reports.personal.read"])).toContain("Reports");
    expect(labels(["roles.read"])).toContain("Settings");
  });
  it("shows everything for a user with every permission", () => {
    const all = NAV.flatMap((g) => g.items.flatMap((i) => i.anyOf ?? []));
    expect(labels(all)).toHaveLength(NAV.flatMap((g) => g.items).length);
  });
});

describe("breadcrumbs", () => {
  it("builds crumbs and names ids 'Details'", () => {
    expect(breadcrumbs("/projects/0b8a3c1e-1111-4222-8333-444455556666")).toEqual([
      { href: "/projects", label: "Projects" },
      { href: "/projects/0b8a3c1e-1111-4222-8333-444455556666", label: "Details" },
    ]);
    expect(breadcrumbs("/tasks/new").map((c) => c.label)).toEqual(["All tasks", "New"]);
    expect(breadcrumbs("/settings/roles").map((c) => c.label)).toEqual(["Settings", "Roles & permissions"]);
  });
});
