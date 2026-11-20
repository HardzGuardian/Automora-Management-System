"use client";

import type { ReactNode } from "react";

/**
 * A filter or sort form that applies as soon as a dropdown changes, so there is no Apply button.
 * It is still a normal GET form: without JavaScript the hidden fallback button below works.
 */
export function AutoForm({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <form
      className={className}
      aria-label={label}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
      <noscript>
        <button type="submit">Apply</button>
      </noscript>
    </form>
  );
}
