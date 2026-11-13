import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "./styles";

/** Bottom-left form actions: one primary submit + a Cancel link. Shows `pendingLabel` while pending. */
export function FormActions({
  label,
  pendingLabel = "Saving…",
  pending,
  cancelHref,
  children,
}: {
  label: string;
  pendingLabel?: string;
  pending: boolean;
  cancelHref?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? pendingLabel : label}
      </button>
      {cancelHref ? (
        <Link href={cancelHref} className={buttonClass("ghost")}>
          Cancel
        </Link>
      ) : null}
      {children}
    </div>
  );
}
