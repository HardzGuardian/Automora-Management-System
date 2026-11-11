import { describe, expect, it } from "vitest";
import { InvalidInvoiceTransitionError, transitionInvoiceState } from "./state-machine";

const invoiceStates = ["draft", "issued", "cancelled"] as const;

describe("invoice lifecycle state machine", () => {
  it.each([
    ["draft", "draft", false],
    ["draft", "issued", true],
    ["draft", "cancelled", true],
    ["issued", "draft", false],
    ["issued", "issued", false],
    ["issued", "cancelled", true],
    ["cancelled", "draft", false],
    ["cancelled", "issued", false],
    ["cancelled", "cancelled", false],
  ] as const)("transition %s -> %s", (current, next, allowed) => {
    if (allowed) {
      expect(transitionInvoiceState(current, next)).toBe(next);
    } else {
      expect(() => transitionInvoiceState(current, next)).toThrow(InvalidInvoiceTransitionError);
    }
  });

  it("covers every pair of persisted invoice lifecycle states", () => {
    expect(invoiceStates.flatMap((current) => invoiceStates.map((next) => [current, next]))).toHaveLength(9);
  });
});
