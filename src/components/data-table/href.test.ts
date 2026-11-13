import { describe, expect, it } from "vitest";
import { buildHref, fillTemplate, nextSort, pageCount } from "./href";

describe("buildHref", () => {
  it("merges, removes undefined and empty params, and keeps others", () => {
    expect(buildHref("/employees", { q: "ann", page: "3" }, { page: "4" })).toBe("/employees?q=ann&page=4");
    expect(buildHref("/employees", { q: "ann", page: "3" }, { page: undefined })).toBe("/employees?q=ann");
    expect(buildHref("/employees", { q: "" }, {})).toBe("/employees");
    expect(buildHref("/x", {}, { q: "a b&c" })).toBe("/x?q=a+b%26c");
  });
});

describe("nextSort", () => {
  it("starts ascending, toggles, and resets the page", () => {
    expect(nextSort({}, "name")).toEqual({ sort: "name", dir: "asc", page: undefined });
    expect(nextSort({ sort: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc", page: undefined });
    expect(nextSort({ sort: "name", dir: "desc" }, "name").dir).toBe("asc");
    expect(nextSort({ sort: "name", dir: "desc" }, "code").dir).toBe("asc");
  });
});

describe("pageCount / fillTemplate", () => {
  it("never returns fewer than one page", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
  it("fills and encodes row values", () => {
    expect(fillTemplate("/employees/{id}", { id: "a b/c" })).toBe("/employees/a%20b%2Fc");
    expect(fillTemplate("/x/{missing}", {})).toBe("/x/");
  });
});
