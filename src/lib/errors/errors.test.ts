import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "./domain-error";
import { toActionResult } from "./to-action-result";

describe("toActionResult", () => {
  it("returns ok with data on success", async () => {
    expect(await toActionResult(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("maps DomainError to code and message", async () => {
    const r = await toActionResult(async () => {
      throw new DomainError("NOT_FOUND", "Task not found");
    });
    expect(r).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Task not found" } });
  });

  it("maps ZodError to VALIDATION with fieldErrors", async () => {
    const r = await toActionResult(async () => z.object({ title: z.string().min(1) }).parse({ title: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION");
      expect(r.error.fieldErrors?.title?.length).toBeGreaterThan(0);
    }
  });

  it("hides unknown error details behind INTERNAL", async () => {
    const r = await toActionResult(async () => {
      throw new Error("select * from secret_table failed at line 3");
    });
    expect(r).toEqual({ ok: false, error: { code: "INTERNAL", message: "Something went wrong" } });
  });
});
