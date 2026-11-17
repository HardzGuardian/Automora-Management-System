import { describe, expect, it } from "vitest";
import { InvalidPaymentTransitionError, transitionPaymentState } from "./state-machine";

describe("payment state machine", () => {
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
      expect(transitionPaymentState(current, next)).toBe(next);
    } else {
      expect(() => transitionPaymentState(current, next)).toThrow(InvalidPaymentTransitionError);
    }
  });
});
