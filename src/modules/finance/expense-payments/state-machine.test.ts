import { describe, expect, it } from "vitest";
import { InvalidExpensePaymentTransitionError, transitionExpensePaymentState } from "./state-machine";

describe("expense payment state machine", () => {
  it.each([
    ["pending", "pending", false],
    ["pending", "confirmed", true],
    ["pending", "reversed", false],
    ["confirmed", "pending", false],
    ["confirmed", "confirmed", false],
    ["confirmed", "reversed", true],
    ["reversed", "pending", false],
    ["reversed", "confirmed", false],
    ["reversed", "reversed", false],
  ] as const)("transition %s -> %s", (current, next, allowed) => {
    if (allowed) {
      expect(transitionExpensePaymentState(current, next)).toBe(next);
    } else {
      expect(() => transitionExpensePaymentState(current, next)).toThrow(InvalidExpensePaymentTransitionError);
    }
  });
});
