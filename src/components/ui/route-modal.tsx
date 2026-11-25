"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** A modal for a route that opens over the page behind it. Closing it goes back to that page. */
export function RouteModal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="Create"
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // a click on the backdrop closes it
      }}
      className="m-auto max-h-[92dvh] w-[min(52rem,94vw)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-body shadow-[var(--elev-3)] backdrop:bg-black/40 [&_[data-back]]:hidden [&_[data-control-panel]]:m-0 [&_[data-control-panel]]:mb-4 [&_[data-control-panel]]:border-0 [&_[data-control-panel]]:bg-transparent [&_[data-control-panel]]:p-0 [&_[data-control-panel]]:pr-10 [&_[data-control-panel]_li:not([aria-current])]:hidden [&_[data-control-panel]_h1]:text-2xl [&_[data-area-chip]]:hidden [&_[data-sheet]]:max-w-none [&_[data-sheet]]:border-0 [&_[data-sheet]]:p-0 [&_[data-sheet]]:shadow-none"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
