import { describe, expect, it } from "vitest";
import { iterateReportPages, ReportChangedDuringExportError } from "./export-pagination";

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const rows: T[] = [];
  for await (const value of values) rows.push(value);
  return rows;
}

describe("report export page iteration", () => {
  it("streams unique rows over a bounded page sequence", async () => {
    const rows = await collect(iterateReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [{ id: "c" }], total: 3, pageSize: 2 }, (row) => row.id));
    expect(rows).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("fails instead of looping when row counts change", async () => {
    const rows = iterateReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [], total: 2, pageSize: 2 }, (row) => row.id);
    await expect(collect(rows)).rejects.toBeInstanceOf(ReportChangedDuringExportError);
  });

  it("rejects duplicate rows caused by offset shifts", async () => {
    const rows = iterateReportPages(async (page) => page === 1
      ? { rows: [{ id: "a" }, { id: "b" }], total: 3, pageSize: 2 }
      : { rows: [{ id: "b" }, { id: "c" }], total: 3, pageSize: 2 }, (row) => row.id);
    await expect(collect(rows)).rejects.toBeInstanceOf(ReportChangedDuringExportError);
  });
});
