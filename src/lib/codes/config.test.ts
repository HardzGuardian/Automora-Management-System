import { describe, expect, it } from "vitest";
import { db, withTransaction } from "@/db";
import { companySettings } from "@/db/schema";
import { createCompany } from "@/test/factories";
import { formatSequence, numberingKey, numberingSchema } from "./config";
import { nextCode } from "./next-code";

describe("numbering format", () => {
  it("formats prefix and padding", () => {
    expect(formatSequence({ prefix: "TK", padding: 4 }, 7)).toBe("TK-0007");
  });

  it("validates the prefix and digit count", () => {
    expect(numberingSchema.safeParse({ prefix: "ab1", padding: 5 })).toMatchObject({ success: true, data: { prefix: "AB1", padding: 5 } });
    expect(numberingSchema.safeParse({ prefix: "TOOLONGPREFIX", padding: 5 }).success).toBe(false);
    expect(numberingSchema.safeParse({ prefix: "A-B", padding: 5 }).success).toBe(false);
    expect(numberingSchema.safeParse({ prefix: "TSK", padding: 2 }).success).toBe(false);
  });
});

describe("nextCode with a saved format", () => {
  it("uses the company's prefix and padding for new numbers only", async () => {
    const c = await createCompany();
    expect(await withTransaction((tx) => nextCode(tx, c.id, "TSK"))).toBe("TSK-000001");
    await db.insert(companySettings).values({ companyId: c.id, settingKey: numberingKey("TSK"), settingValueJson: { prefix: "WRK", padding: 4 } });
    expect(await withTransaction((tx) => nextCode(tx, c.id, "TSK"))).toBe("WRK-0002");
  });
});
