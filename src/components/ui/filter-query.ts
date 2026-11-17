/** Query-string logic for FilterBar (pure, so it can be tested). */

/** Params that are not filters: they never count as "a filter is on". */
const NOT_FILTERS = new Set(["page", "sort", "dir", "tab", "view", "layout", "bulk", "bulkError", "error"]);
/** Params kept when a filter changes, so sorting and the list/board layout survive filtering. */
const KEEP = ["sort", "dir", "layout"];

type ReadonlyParams = { get(name: string): string | null; keys(): Iterable<string> };

/** Builds the next query from the form's fields: blanks dropped, sort kept, page reset. */
export function buildFilterQuery(fields: [string, string][], current: ReadonlyParams): string {
  const next = new URLSearchParams();
  for (const [k, v] of fields) {
    const value = v.trim();
    if (value !== "") next.append(k, value);
  }
  for (const k of KEEP) {
    const v = current.get(k);
    if (v && !next.has(k)) next.set(k, v);
  }
  return next.toString();
}

/** Where "Clear" goes: the same page with every filter off, keeping only the layout. */
export function buildClearQuery(current: ReadonlyParams): string {
  const layout = current.get("layout");
  return layout ? new URLSearchParams({ layout }).toString() : "";
}

export function hasActiveFilters(current: ReadonlyParams): boolean {
  for (const k of current.keys()) {
    if (!NOT_FILTERS.has(k) && (current.get(k) ?? "") !== "") return true;
  }
  return false;
}
