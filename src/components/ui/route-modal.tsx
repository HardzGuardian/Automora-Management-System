"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

/** A modal for a route that opens over the page behind it. Closing it goes back to that page. */
export function RouteModal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [opened] = useState(pathname);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // After a save the app moves on to another page; the modal must not stay open over it.
  if (pathname !== opened) return null;

  return (
    <dialog
      ref={ref}
      aria-label="Create"
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // a click on the backdrop closes it
      }}
      className="m-auto max-h-[92dvh] w-[min(52rem,94vw)] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-body shadow-xl backdrop:bg-black/40 [&_[data-back]]:hidden"
    >
      <div className="relative p-6">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-foreground"
        >
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
