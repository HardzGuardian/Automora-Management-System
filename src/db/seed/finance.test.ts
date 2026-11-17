import { describe, expect, it } from "vitest";
import { defaultExpenseCategoryRows, DEFAULT_EXPENSE_CATEGORIES } from "./finance";

describe("default finance seed data", () => {
  it("creates active company-scoped categories with stable names", () => {
    const rows = defaultExpenseCategoryRows("company-1");
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.companyId === "company-1" && row.active)).toBe(true);
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    expect(rows.map(({ name }) => name)).toEqual(DEFAULT_EXPENSE_CATEGORIES.map(({ name }) => name));
  });
});
