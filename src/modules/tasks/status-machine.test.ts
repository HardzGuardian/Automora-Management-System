import { describe, expect, it } from "vitest";
import { TASK_TRANSITIONS, allowedTransitions, canTransition, isOwnTransitionAllowed } from "./status-machine";

describe("task status machine", () => {
  const valid: [string, string][] = [
    ["Pending", "In Progress"],
    ["In Progress", "In Review"],
    ["In Progress", "Pending"],
    ["In Review", "Completed"],
    ["In Review", "In Progress"],
    ["Completed", "In Progress"], // reopen
  ];
  it.each(valid)("allows %s -> %s", (from, to) => expect(canTransition(from, to)).toBe(true));

  const invalid: [string, string][] = [
    ["Pending", "In Review"],
    ["Pending", "Completed"],
    ["In Progress", "Completed"],
    ["Completed", "Pending"],
    ["Completed", "In Review"],
    ["Pending", "Pending"],
    ["Unknown", "Pending"],
  ];
  it.each(invalid)("rejects %s -> %s", (from, to) => expect(canTransition(from, to)).toBe(false));

  it("covers every status as a key", () => {
    expect(Object.keys(TASK_TRANSITIONS).sort()).toEqual(["Completed", "In Progress", "In Review", "Pending"]);
  });

  it("lets assignees move work forward and back but not complete or reopen it", () => {
    expect(isOwnTransitionAllowed("Pending", "In Progress")).toBe(true);
    expect(isOwnTransitionAllowed("In Progress", "In Review")).toBe(true);
    expect(isOwnTransitionAllowed("In Review", "In Progress")).toBe(true);
    expect(isOwnTransitionAllowed("In Progress", "Pending")).toBe(true);
    expect(isOwnTransitionAllowed("In Review", "Completed")).toBe(false);
    expect(isOwnTransitionAllowed("Completed", "In Progress")).toBe(false);
  });

  it("lists allowed next statuses", () => {
    expect(allowedTransitions("Pending")).toEqual(["In Progress"]);
    expect(allowedTransitions("Nope")).toEqual([]);
  });
});
