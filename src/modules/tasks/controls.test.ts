import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/actor";
import { rowControls } from "./controls";

const actor = (keys: string[], employeeId: string | null = "me"): Actor =>
  ({ userId: "u", companyId: "c", employeeId, roles: [], permissions: new Set(keys), timezone: "UTC" }) as unknown as Actor;

const task = (status: string, assigneeIds: string[], archived = false) => ({
  status,
  archived,
  assignees: assigneeIds.map((id) => ({ employeeId: id, fullName: id, viaTeamId: null })),
});

describe("rowControls", () => {
  it("lets a manager tick done and pick any step the state machine allows", () => {
    const c = rowControls(actor(["tasks.update"]), task("In Review", ["x"]));
    expect(c.canToggle).toBe(true);
    expect(c.statuses).toEqual(["In Review", "Completed", "In Progress"]);
  });

  it("lets an assignee step their own task up to In Review, never Completed, and no done tick", () => {
    const c = rowControls(actor(["tasks.status.update.own"]), task("In Progress", ["me"]));
    expect(c.canToggle).toBe(false);
    expect(c.statuses).toEqual(["In Progress", "In Review", "Pending"]);
    expect(rowControls(actor(["tasks.status.update.own"]), task("In Review", ["me"])).statuses).toEqual(["In Review", "In Progress"]);
  });

  it("offers nothing on someone else's task, a completed task, or an archived task", () => {
    const own = actor(["tasks.status.update.own"]);
    expect(rowControls(own, task("Pending", ["someone-else"]))).toEqual({ canToggle: false, statuses: [] });
    expect(rowControls(own, task("Completed", ["me"])).statuses).toEqual(["Completed"]); // cannot reopen
    expect(rowControls(actor(["tasks.update"]), task("Pending", ["me"], true))).toEqual({ canToggle: false, statuses: [] });
  });
});
