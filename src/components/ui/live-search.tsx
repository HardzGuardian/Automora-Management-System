"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "./styles";

/**
 * A search box that filters the list below while you type (after a short pause): no pop-up and no Enter to
 * press. It stays a normal `<input name>` inside its form, so the form and its Search button still work
 * without JavaScript. Every other filter in the address (tab, status, sort, layout, ...) is kept; the page
 * number is reset because a new search starts at the first page.
 */
export function LiveSearch({
  name = "q",
  defaultValue = "",
  placeholder = "Search",
  id,
  label,
  className,
  maxLength,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Pair with a visible or sr-only `<label htmlFor>`. */
  id?: string;
  /** Accessible name when there is no `<label>`. */
  label?: string;
  className?: string;
  maxLength?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (text: string) => {
    const next = new URLSearchParams(current.toString());
    const q = text.trim();
    if (q) next.set(name, q);
    else next.delete(name);
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <input
      id={id}
      name={name}
      type="search"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete="off"
      aria-label={label}
      aria-busy={pending}
      className={className ?? inputClass}
      onChange={(e) => {
        setValue(e.target.value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => apply(e.target.value), 250);
      }}
      onKeyDown={(e) => {
        // Enter filters straight away instead of reloading the whole page.
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(timer.current);
          apply(value);
        }
      }}
    />
  );
}
