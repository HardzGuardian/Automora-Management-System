"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { buttonClass } from "./styles";
import { buildClearQuery, buildFilterQuery, hasActiveFilters } from "./filter-query";

/**
 * Filter row for list pages. Changing a filter applies it straight away (text waits for a pause in
 * typing); there is no Filter button to hunt for. "Clear" appears only while a filter is on.
 * Still a real GET form with `role="search"`, so it works without JavaScript and by pressing Enter.
 * Controls need accessible names (aria-label or a visible label).
 */
export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    if (!form.current) return;
    const entries = [...new FormData(form.current)].filter((e): e is [string, string] => typeof e[1] === "string");
    const qs = buildFilterQuery(entries, current);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onChange = (e: FormEvent<HTMLFormElement>) => {
    clearTimeout(timer.current);
    const t = e.target;
    const typing = t instanceof HTMLInputElement && (t.type === "search" || t.type === "text");
    if (typing) timer.current = setTimeout(apply, 400);
    else apply();
  };

  return (
    <form
      ref={form}
      method="get"
      role="search"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        apply();
      }}
    >
      {children}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
      {hasActiveFilters(current) ? (
        <Link href={buildClearQuery(current) ? `${pathname}?${buildClearQuery(current)}` : pathname} className={buttonClass("ghost")}>
          Clear
        </Link>
      ) : null}
    </form>
  );
}
