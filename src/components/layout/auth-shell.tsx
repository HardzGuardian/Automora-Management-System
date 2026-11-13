import type { ReactNode } from "react";

/**
 * Sign-in family layout: form on the left, a quiet product panel on the right from `lg` up.
 * On mobile it is a single column with the wordmark above the form.
 */
export function AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div className="flex flex-col justify-center px-4 py-10 sm:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <p className="text-xl font-bold text-primary lg:hidden">Automora</p>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
          {children}
          {footer ? <div className="text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
      <aside aria-hidden="true" className="hidden flex-col justify-between border-l border-border bg-primary-soft p-12 lg:flex">
        <p className="text-2xl font-bold text-primary">Automora</p>
        <p className="max-w-xs text-base leading-relaxed text-foreground">
          One place for your team&apos;s tasks, projects, clients and invoices, with every change tracked.
        </p>
      </aside>
    </main>
  );
}
