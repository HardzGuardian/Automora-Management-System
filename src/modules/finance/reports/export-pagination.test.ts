import { describe, expect, it } from "vitest";
import { collectReportPages } from "./export-pagination";

describe("report export page collection", () => {
  it("collects each unique row over a bounded sequence", async () => {
    const result = await collectReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [{ id: "c" }], total: 3, pageSize: 2 }, (row) => row.id);
    expect(result).toEqual({ rows: [{ id: "a" }, { id: "b" }, { id: "c" }], complete: true });
  });

  it("stops and marks the collection incomplete when the report changes", async () => {
    const result = await collectReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [], total: 2, pageSize: 2 }, (row) => row.id);
    expect(result.complete).toBe(false);
  });

  it("stops on duplicate rows rather than looping past the bounded page count", async () => {
    const result = await collectReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [{ id: "b" }, { id: "c" }], total: 3, pageSize: 2 }, (row) => row.id);
    expect(result).toEqual({ rows: [{ id: "a" }, { id: "b" }, { id: "c" }], complete: true });
  });
});
