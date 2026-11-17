import { describe, expect, it } from "vitest";
import { withTransaction } from "@/db";
import { createCompany } from "@/test/factories";
import { nextCode } from "./next-code";

describe("nextCode", () => {
  it("starts at 000001 and increments per kind", async () => {
    const c = await createCompany();
    const first = await withTransaction((tx) => nextCode(tx, c.id, "TSK"));
    const second = await withTransaction((tx) => nextCode(tx, c.id, "TSK"));
    const other = await withTransaction((tx) => nextCode(tx, c.id, "PRJ"));
    expect([first, second, other]).toEqual(["TSK-000001", "TSK-000002", "PRJ-000001"]);
  });

  it("keeps separate sequences per company", async () => {
    const a = await createCompany();
    const b = await createCompany();
    await withTransaction((tx) => nextCode(tx, a.id, "EMP"));
    expect(await withTransaction((tx) => nextCode(tx, b.id, "EMP"))).toBe("EMP-000001");
  });

  it("gives 50 concurrent callers 50 distinct codes with no gaps", async () => {
    const c = await createCompany();
    const codes = await Promise.all(
      Array.from({ length: 50 }, () => withTransaction((tx) => nextCode(tx, c.id, "TSK"))),
    );
    expect(new Set(codes).size).toBe(50);
    const nums = codes.map((x) => Number(x.slice(4))).sort((p, q) => p - q);
    expect(nums[0]).toBe(1);
    expect(nums[49]).toBe(50);
  });
});
