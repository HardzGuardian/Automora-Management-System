import { describe, expect, it } from "vitest";
import { todayInTz } from "./index";

describe("todayInTz", () => {
  it("uses the company timezone, not UTC", () => {
    const instant = new Date("2026-03-10T20:00:00Z"); // 01:30 on the 11th in Kolkata, 16:00 on the 10th in New York
    expect(todayInTz("Asia/Kolkata", instant)).toBe("2026-03-11");
    expect(todayInTz("America/New_York", instant)).toBe("2026-03-10");
    expect(todayInTz("UTC", instant)).toBe("2026-03-10");
  });
});
