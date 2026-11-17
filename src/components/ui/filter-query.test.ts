import { describe, expect, it } from "vitest";
import { buildClearQuery, buildFilterQuery, hasActiveFilters } from "./filter-query";

const params = (qs: string) => new URLSearchParams(qs);

describe("buildFilterQuery", () => {
  it("keeps filled fields, drops blanks and trims", () => {
    expect(buildFilterQuery([["q", "  ann "], ["status", ""], ["overdue", "1"]], params(""))).toBe("q=ann&overdue=1");
  });

  it("resets the page but keeps the sort", () => {
    expect(buildFilterQuery([["status", "Active"]], params("page=3&sort=name&dir=desc&status=Old"))).toBe("status=Active&sort=name&dir=desc");
  });

  it("does not duplicate sort when the form already carries it", () => {
    expect(buildFilterQuery([["sort", "due"], ["q", "x"]], params("sort=name"))).toBe("sort=due&q=x");
  });

  it("returns an empty query when everything is cleared", () => {
    expect(buildFilterQuery([["q", ""], ["status", "  "]], params("page=2"))).toBe("");
  });

  it("encodes values safely", () => {
    expect(buildFilterQuery([["q", "a&b=c"]], params(""))).toBe("q=a%26b%3Dc");
  });
});

describe("buildClearQuery", () => {
  it("drops every filter but keeps the list/board layout", () => {
    expect(buildClearQuery(params("status=Pending&q=x&layout=board&page=2"))).toBe("layout=board");
    expect(buildClearQuery(params("status=Pending"))).toBe("");
  });
  it("keeps layout when filtering", () => {
    expect(buildFilterQuery([["q", "x"]], params("layout=board"))).toBe("q=x&layout=board");
  });
});

describe("hasActiveFilters", () => {
  it("ignores paging, sorting and feedback params", () => {
    expect(hasActiveFilters(params("page=2&sort=name&dir=asc&bulk=2-0&error=x&layout=board"))).toBe(false);
    expect(hasActiveFilters(params(""))).toBe(false);
  });
  it("is true for any real filter, false for an empty one", () => {
    expect(hasActiveFilters(params("status=Pending"))).toBe(true);
    expect(hasActiveFilters(params("q="))).toBe(false);
  });
});
