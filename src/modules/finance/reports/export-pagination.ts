export type ReportPage<T> = {
  rows: readonly T[];
  total: number;
  pageSize: number;
};

export type ReportPageCollection<T> = {
  rows: T[];
  complete: boolean;
};

/** Collects a bounded page sequence and detects changes instead of retrying forever. */
export async function collectReportPages<T>(
  fetchPage: (page: number) => Promise<ReportPage<T>>,
  keyForRow: (row: T) => string,
): Promise<ReportPageCollection<T>> {
  const first = await fetchPage(1);
  if (!Number.isSafeInteger(first.total) || first.total < 0 || !Number.isSafeInteger(first.pageSize) || first.pageSize <= 0) {
    return { rows: [], complete: false };
  }
  const expectedTotal = first.total;
  const rows = new Map<string, T>();
  for (const row of first.rows) rows.set(keyForRow(row), row);
  if (rows.size > expectedTotal) return { rows: [...rows.values()], complete: false };

  const lastPage = Math.ceil(expectedTotal / first.pageSize);
  for (let page = 2; page <= lastPage && rows.size < expectedTotal; page += 1) {
    const next = await fetchPage(page);
    if (next.total !== expectedTotal || next.pageSize !== first.pageSize || next.rows.length === 0) {
      return { rows: [...rows.values()], complete: false };
    }
    for (const row of next.rows) rows.set(keyForRow(row), row);
  }
  return { rows: [...rows.values()], complete: rows.size === expectedTotal };
}
