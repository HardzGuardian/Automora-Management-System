import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type Facet = { label: string; value: string; removeHref: string };

/** The box that looks like Odoo's search field; facet chips and the input sit inside it. */
export function SearchBox({ facets = [], children }: { facets?: Facet[]; children: ReactNode }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-field bg-surface px-2.5 py-1 shadow-[var(--elev-1)] focus-within:border-primary focus-within:outline focus-within:outline-2 focus-within:outline-[color-mix(in_srgb,var(--primary)_35%,transparent)]">
      <Icon name="search" size={16} className="flex-none text-muted" />
      {facets.map((f) => (
        <span key={`${f.label}:${f.value}`} className="inline-flex max-w-full items-center overflow-hidden rounded-md border border-primary/25 bg-primary-soft text-[12.5px] text-primary-ink">
          <span className="bg-primary px-1.5 py-0.5 font-medium text-white">{f.label}</span>
          <span className="truncate px-1.5">{f.value}</span>
          <Link href={f.removeHref} aria-label={`Remove filter ${f.label}: ${f.value}`} className="inline-flex size-6 items-center justify-center hover:bg-primary/15">
            <Icon name="close" size={12} strokeWidth={2.6} />
          </Link>
        </span>
      ))}
      <div className="min-w-[140px] flex-1 [&_input]:min-h-8 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1 [&_input]:shadow-none [&_input]:outline-none [&_input:focus]:outline-none">
        {children}
      </div>
    </div>
  );
}

/**
 * A plain Odoo-style search for list pages: a GET form on `param`, keeping the page's other filters.
 * Enter searches; each active filter shows as a chip that can be removed.
 */
export function FacetSearch({
  param = "q",
  value = "",
  placeholder = "Search...",
  label = "Search",
  keep = {},
  facets = [],
}: {
  param?: string;
  value?: string;
  placeholder?: string;
  label?: string;
  /** Other query params to carry over when searching (filters, tab, view). */
  keep?: Record<string, string | undefined>;
  facets?: Facet[];
}) {
  return (
    <form method="get" role="search" aria-label={label}>
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <SearchBox facets={facets}>
        <input name={param} type="search" defaultValue={value} placeholder={placeholder} aria-label={label} className="w-full text-sm text-foreground placeholder:text-muted" />
      </SearchBox>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}

/** Builds a URL from a path and params, dropping empty ones (used for chip "remove" links). */
export function hrefWith(path: string, params: Record<string, string | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
