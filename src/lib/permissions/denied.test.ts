import { afterEach, describe, expect, it, vi } from "vitest";
import { buildActor } from "@/test/factories";
import { registerDenialReporter } from "./denied";
import { requirePermission } from "./require";

afterEach(() => registerDenialReporter(undefined));

describe("requirePermission reports denials", () => {
  const nobody = () => buildActor({ companyId: "11111111-1111-4111-8111-111111111111", permissions: new Set() });
  const allowed = () => buildActor({ companyId: "11111111-1111-4111-8111-111111111111", permissions: new Set(["tasks.create"]) });

  it("tells the reporter who was refused and which permission, and still refuses", () => {
    const seen = vi.fn();
    registerDenialReporter(seen);
    const actor = nobody();
    expect(() => requirePermission(actor, "tasks.create")).toThrowError(/permission/);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(actor, "tasks.create");
  });

  it("stays silent when the check passes", () => {
    const seen = vi.fn();
    registerDenialReporter(seen);
    expect(() => requirePermission(allowed(), "tasks.create")).not.toThrow();
    expect(seen).not.toHaveBeenCalled();
  });

  it("a failing reporter never changes the outcome", () => {
    registerDenialReporter(() => {
      throw new Error("monitoring is down");
    });
    expect(() => requirePermission(nobody(), "tasks.create")).toThrowError(/You do not have permission/);
  });

  it("works with no reporter registered", () => {
    expect(() => requirePermission(nobody(), "tasks.create")).toThrowError(/permission/);
  });
});
