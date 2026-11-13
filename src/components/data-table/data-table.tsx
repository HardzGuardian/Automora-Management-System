"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { buildHref, fillTemplate, nextSort, pageCount, type Params } from "./href";

export type DataRow = Record<string, string | number | boolean | null>;
export type DataColumn = {
  key: string;
  header: string;
  /** How the cell renders. "link" needs `href` like "/employees/{id}". */
  kind?: "text" | "status" | "link" | "number";
  href?: string;
  /** Query value for `sort=` when it differs from `key`. */
  sortKey?: string;
  /** Server-side sortable: the page's query must understand `sort=<key>`. */
  sortable?: boolean;
  defaultHidden?: boolean;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, DataRow>();

/**
 * Shared list table (blueprint U-05). Sorting and pagination are server-side and live in the URL
 * (shareable, back-button friendly). Selection (for bulk forms), column visibility and row
 * actions are optional. Data is passed in as plain rows; this component never fetches.
 */
export function DataTable({
  caption,
  columns,
  rows,
  total,
  page,
  pageSize,
  basePath,
  params,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selectFormId,
  rowActions,
}: {
  caption: string;
  columns: DataColumn[];
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  /** Current URL params (q, status, sort, dir, page, ...). */
  params: Params;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: { href: string; label: string };
  selectFormId?: string;
  rowActions?: { label: string; href: string }[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  const visible = useMemo(() => columns.filter((c) => !hidden.has(c.key)), [columns, hidden]);

  const defs = useMemo(
    () =>
      helper.columns(
        visible.map((c) =>
          helper.accessor((row: DataRow) => row[c.key], {
            id: c.key,
            header: c.header,
            cell: (info) => {
              const v = info.getValue();
              const row = info.row.original;
              if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
              if (c.kind === "status") return <StatusBadge status={String(v)} />;
              if (c.kind === "link" && c.href)
                return (
                  <Link href={fillTemplate(c.href, row)} className="font-medium underline">
                    {String(v)}
                  </Link>
                );
              return String(v);
            },
          }),
        ),
      ),
    [visible],
  );

  const table = useTable({ features, columns: defs, data: rows, getRowId: (_row, i) => String(i) });
  const pages = pageCount(total, pageSize);
  const href = (patch: Params) => buildHref(basePath, params, patch);
  const sorted = params.sort;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite">
          {total} result{total === 1 ? "" : "s"}
        </p>
        {columns.length > 3 && rows.length > 0 ? (
          <details className="relative">
            <summary className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2">Columns</summary>
            <fieldset className="absolute right-0 z-10 mt-1 flex w-52 flex-col gap-1 rounded-md border border-border bg-surface p-3 shadow-md">
              <legend className="sr-only">Visible columns</legend>
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    onChange={() =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.key)) next.delete(c.key);
                        else if (columns.length - next.size > 1) next.add(c.key); // keep at least one column
                        return next;
                      })
                    }
                  />
                  {c.header}
                </label>
              ))}
            </fieldset>
          </details>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[32rem] rounded-none border-0 text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 bg-primary-soft">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {selectFormId ? (
                    <th scope="col" className="w-10 px-3 py-2">
                      <span className="sr-only">Select</span>
                    </th>
                  ) : null}
                  {group.headers.map((header) => {
                    const col = visible.find((c) => c.key === header.column.id)!;
                    const sk = col.sortKey ?? col.key;
                    const active = sorted === sk;
                    const dir = params.dir === "desc" ? "descending" : "ascending";
                    return (
                      <th key={header.id} scope="col" aria-sort={active ? dir : undefined} className="px-3 py-2 font-semibold">
                        {col.sortable ? (
                          <Link href={href(nextSort(params, sk))} className="inline-flex items-center gap-1 hover:underline">
                            {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                            <span aria-hidden="true">{active ? (params.dir === "desc" ? "▼" : "▲") : "↕"}</span>
                            <span className="sr-only">{active ? `sorted ${dir}, change sort` : "sort"}</span>
                          </Link>
                        ) : header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                  {rowActions ? (
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-background">
                  {selectFormId ? (
                    <td className="px-3 py-2">
                      <input type="checkbox" name="ids" value={String(row.original.id)} form={selectFormId} aria-label={`Select row ${Number(row.id) + 1}`} />
                    </td>
                  ) : null}
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={cn("px-3 py-2", visible.find((c) => c.key === cell.column.id)?.kind === "number" && "text-right tabular-nums")}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="px-3 py-2">
                      {rowActions.map((a) => (
                        <Link key={a.label} href={fillTemplate(a.href, row.original)} className="mr-2 underline">
                          {a.label}
                        </Link>
                      ))}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3 text-sm">
        {page > 1 ? (
          <Link href={href({ page: String(page - 1) })} className="underline">
            Previous
          </Link>
        ) : (
          <span className="text-muted">Previous</span>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href({ page: String(page + 1) })} className="underline">
            Next
          </Link>
        ) : (
          <span className="text-muted">Next</span>
        )}
      </nav>
      ) : null}
    </div>
  );
}
