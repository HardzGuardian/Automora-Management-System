import { describe, expect, it } from "vitest";
import { isUuid, parsePage } from "./pagination";

describe("parsePage", () => {
  it.each([
    [undefined, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-4", 1],
    ["1.5", 1],
    ["2.9", 2],
    ["7", 7],
    ["1e21", 10000],
    ["Infinity", 1],
    ["99999999", 10000],
  ])("%j -> %i", (raw, expected) => expect(parsePage(raw)).toBe(expected));

  it("takes the first value of a repeated param and honours a custom max", () => {
    expect(parsePage(["3", "9"])).toBe(3);
    expect(parsePage("50", 20)).toBe(20);
  });
});

describe("isUuid", () => {
  it("accepts canonical uuids only", () => {
    expect(isUuid("6576bade-1fbe-420a-8010-f98b38e8ad81")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("6576bade-1fbe-420a-8010-f98b38e8ad81x")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
