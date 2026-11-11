export type ReportPage<T> = {
  rows: readonly T[];
  total: number;
  pageSize: number;
};

export class ReportChangedDuringExportError extends Error {
  constructor() {
    super("Report data changed while the export was being generated.");
    this.name = "ReportChangedDuringExportError";
  }
}

/** Streams bounded report pages and aborts if paging no longer represents one result set. */
export async function* iterateReportPages<T>(
  fetchPage: (page: number) => Promise<ReportPage<T>>,
  keyForRow: (row: T) => string,
): AsyncGenerator<T> {
  const first = await fetchPage(1);
  if (!Number.isSafeInteger(first.total) || first.total < 0 || !Number.isSafeInteger(first.pageSize) || first.pageSize <= 0) {
    throw new ReportChangedDuringExportError();
  }
  const expectedTotal = first.total;
  const lastPage = Math.ceil(expectedTotal / first.pageSize);
  const seen = new Set<string>();
  let count = 0;

  const emitRows = async function* (rows: readonly T[]): AsyncGenerator<T> {
    for (const row of rows) {
      const key = keyForRow(row);
      if (seen.has(key) || count >= expectedTotal) throw new ReportChangedDuringExportError();
      seen.add(key);
      count += 1;
      yield row;
    }
  };

  yield* emitRows(first.rows);
  for (let page = 2; page <= lastPage && count < expectedTotal; page += 1) {
    const next = await fetchPage(page);
    if (next.total !== expectedTotal || next.pageSize !== first.pageSize || next.rows.length === 0) {
      throw new ReportChangedDuringExportError();
    }
    yield* emitRows(next.rows);
  }
  if (count !== expectedTotal) throw new ReportChangedDuringExportError();
}
