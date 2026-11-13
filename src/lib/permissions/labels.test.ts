import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS } from "./catalog";
import { AREA_TITLES, PERMISSION_LABELS, permissionArea } from "./labels";

describe("permission labels", () => {
  it("has a plain label for every permission and no extras", () => {
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual([...ALL_PERMISSION_KEYS].sort());
  });

  it("never shows a technical key as a label, and labels are unique", () => {
    const labels = Object.values(PERMISSION_LABELS);
    for (const l of labels) {
      expect(l, l).not.toMatch(/\w\.\w/);
      expect(l.length).toBeGreaterThan(5);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("files every permission under a titled area", () => {
    for (const k of ALL_PERMISSION_KEYS) expect(AREA_TITLES[permissionArea(k)], k).toBeTruthy();
  });

  it("splits finance by resource and keeps other areas by their first segment", () => {
    expect(permissionArea("finance.invoices.issue")).toBe("finance.invoices");
    expect(permissionArea("finance.reports.read")).toBe("finance.reports");
    expect(permissionArea("tasks.status.update.own")).toBe("tasks");
  });
});
