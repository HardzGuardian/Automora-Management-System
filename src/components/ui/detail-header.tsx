import type { ReactNode } from "react";

/**
 * Detail page header: title (h1), code in muted text, badges, and 2-4 inline key facts.
 * Put actions in a separate row below it so destructive ones can sit apart.
 */
export function DetailHeader({
  title,
  code,
  badges,
  facts,
}: {
  title: string;
  code?: string;
  badges?: ReactNode;
  facts?: ReactNode[];
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        {code ? <span className="text-sm text-muted">{code}</span> : null}
        {badges}
      </div>
      {facts && facts.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
