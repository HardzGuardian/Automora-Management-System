import { describe, expect, it } from "vitest";
import { statusView } from "./status";

describe("statusView", () => {
  it("maps task statuses to the design contract colours", () => {
    expect(statusView("Completed").tone).toBe("success");
    expect(statusView("In Progress").tone).toBe("info");
    expect(statusView("Pending").tone).toBe("warning");
  });
  it("marks overdue as danger with text, not colour alone", () => {
    const v = statusView("Pending", { overdue: true });
    expect(v.tone).toBe("danger");
    expect(v.label).toContain("Overdue");
    expect(v.icon.length).toBeGreaterThan(0);
  });
  it("formats snake_case finance statuses and handles unknown ones", () => {
    expect(statusView("partially_paid").label).toBe("Partially paid");
    expect(statusView("weird_new")).toMatchObject({ tone: "neutral", label: "Weird new" });
  });
  it("every known status has a non-empty icon and label", () => {
    for (const s of ["Pending", "Completed", "On Hold", "issued", "paid", "overdue", "reversed", "Suspended"]) {
      const v = statusView(s);
      expect(v.icon).not.toBe("");
      expect(v.label).not.toBe("");
    }
  });
});
