export type Params = Record<string, string | undefined>;

/** Builds a link to the same page with some query params changed. `undefined` removes a param. */
export function buildHref(basePath: string, current: Params, patch: Params): string {
  const merged: Params = { ...current, ...patch };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") q.set(k, v);
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Next sort state when a header is clicked: asc → desc → asc, and a new column starts ascending. Resets to page 1. */
export function nextSort(current: { sort?: string; dir?: string }, key: string): Params {
  const dir = current.sort === key && current.dir !== "desc" ? "desc" : "asc";
  return { sort: key, dir, page: undefined };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** "href template" like /employees/{id} filled from a row. Values are URI-encoded. */
export function fillTemplate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(row[k] ?? "")));
}
