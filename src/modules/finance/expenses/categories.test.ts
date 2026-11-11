import { describe, expect, it } from "vitest";
import { createExpenseCategorySchema } from "./schemas";

describe("expense category input", () => {
  it("trims names and optional descriptions", () => {
    expect(createExpenseCategorySchema.parse({ name: "  Travel  ", description: "  Taxi  " })).toEqual({
      name: "Travel",
      description: "Taxi",
    });
  });

  it.each([
    { name: "   " },
    { name: "x".repeat(121) },
    { name: "Travel", description: "x".repeat(501) },
  ])("rejects invalid category input", (input) => {
    expect(createExpenseCategorySchema.safeParse(input).success).toBe(false);
  });
});
