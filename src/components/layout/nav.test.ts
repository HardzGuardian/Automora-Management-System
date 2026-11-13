import { describe, expect, it } from "vitest";
import { NAV, visibleNav } from "./nav";

const labels = (perms: string[]) => visibleNav(new Set(perms)).flatMap((g) => g.items.map((i) => i.label));

describe("visibleNav", () => {
  it("keeps the bell and account menu out of the sidebar (they are in the top bar)", () => {
    const all = NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(all).not.toContain("/notifications");
    expect(all).not.toContain("/profile");
  });
  it("shows an employee only the universal items", () => {
    expect(labels([])).toEqual(["Dashboard", "My tasks", "All tasks", "Projects", "Teams"]);
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
