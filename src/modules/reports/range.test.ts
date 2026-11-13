import { describe, expect, it } from "vitest";
import { resolveRange } from "./range";

const at = (iso: string) => new Date(iso);

describe("resolveRange", () => {
  it("today is the company-local date, not UTC", () => {
    const now = at("2026-03-10T20:00:00Z"); // 11 Mar in Kolkata, 10 Mar in New York
    expect(resolveRange("today", "Asia/Kolkata", now)).toMatchObject({ from: "2026-03-11", to: "2026-03-11", today: "2026-03-11" });
    expect(resolveRange("today", "America/New_York", now)).toMatchObject({ from: "2026-03-10", to: "2026-03-10" });
  });

  it("week runs Monday to Sunday containing today", () => {
    expect(resolveRange("week", "UTC", at("2026-03-11T10:00:00Z"))).toMatchObject({ from: "2026-03-09", to: "2026-03-15" }); // Wed
    expect(resolveRange("week", "UTC", at("2026-03-15T10:00:00Z"))).toMatchObject({ from: "2026-03-09", to: "2026-03-15" }); // Sun
    expect(resolveRange("week", "UTC", at("2026-03-09T00:30:00Z"))).toMatchObject({ from: "2026-03-09", to: "2026-03-15" }); // Mon
  });

  it("month covers the calendar month incl. leap February and December", () => {
    expect(resolveRange("month", "UTC", at("2028-02-10T00:00:00Z"))).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
    expect(resolveRange("month", "UTC", at("2026-12-31T23:00:00Z"))).toMatchObject({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("quarter covers three calendar months", () => {
    expect(resolveRange("quarter", "UTC", at("2026-05-20T00:00:00Z"))).toMatchObject({ from: "2026-04-01", to: "2026-06-30" });
    expect(resolveRange("quarter", "UTC", at("2026-01-01T00:00:00Z"))).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    expect(resolveRange("quarter", "UTC", at("2026-12-31T00:00:00Z"))).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("custom uses valid ordered dates and rejects bad ones", () => {
    expect(resolveRange("custom", "UTC", at("2026-03-10T00:00:00Z"), { from: "2026-01-05", to: "2026-02-10" })).toMatchObject({ from: "2026-01-05", to: "2026-02-10" });
    expect(() => resolveRange("custom", "UTC", new Date(), { from: "2026-02-10", to: "2026-01-05" })).toThrow();
    expect(() => resolveRange("custom", "UTC", new Date(), { from: "2026-02-30", to: "2026-03-05" })).toThrow();
    expect(() => resolveRange("custom", "UTC", new Date())).toThrow();
    expect(() => resolveRange("custom", "UTC", new Date(), { from: "2020-01-01", to: "2026-01-01" })).toThrow(); // > 5 years
  });

  it("rejects unknown presets", () => {
    expect(() => resolveRange("decade" as never, "UTC", new Date())).toThrow();
  });
});
