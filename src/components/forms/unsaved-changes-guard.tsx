"use client";

import { useEffect, useRef, useState } from "react";
import { useUnsavedChangesWarning } from "./form-kit";
import { isLeavingPage, UNSAVED_CHANGES_MESSAGE } from "./unsaved-changes";

/**
 * Drop inside a <form>. Once the user edits any field it warns before a reload/close (browser dialog)
 * and before following an in-app link. Submitting or resetting the form clears the warning.
 */
export function UnsavedChangesGuard() {
  const marker = useRef<HTMLSpanElement>(null);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    const markDirty = () => setDirty(true);
    const clear = () => setDirty(false);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", clear);
    form.addEventListener("reset", clear);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", clear);
      form.removeEventListener("reset", clear);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const leaving = isLeavingPage({
        href: anchor.href,
        currentUrl: window.location.href,
        target: anchor.target,
        download: anchor.hasAttribute("download"),
        button: e.button,
        modifier: e.ctrlKey || e.metaKey || e.shiftKey || e.altKey,
        defaultPrevented: e.defaultPrevented,
      });
      if (leaving && !window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // Capture phase so we run before Next's <Link> handler starts the client-side navigation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  return <span ref={marker} hidden />;
}
