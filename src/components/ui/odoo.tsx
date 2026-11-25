import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/*
 * Odoo-style building blocks shared by every screen:
 *   ControlPanel  breadcrumbs, primary actions, search, quick filters, pager and view switcher
 *   FormView      a record: action buttons + stage bar, a white "sheet", and the chatter beside it
 *   SheetTitle, SmartButtons, FieldGrid, NotebookTabs, StatusBar  the parts inside a sheet
 * Server components; the interactive bits (search, chatter composer) are passed in as nodes.
 */

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ crumbs, heading = true }: { crumbs: Crumb[]; heading?: boolean }) {
  const last = crumbs[crumbs.length - 1];
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-0.5 p-0 text-[1.15rem] leading-7">
        {crumbs.slice(0, -1).map((c) => (
          <li key={`${c.label}-${c.href ?? ""}`} className="flex items-center gap-1.5">
            {c.href ? (
              <Link href={c.href} className="font-medium text-primary-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="text-muted">{c.label}</span>
            )}
            <span aria-hidden="true" className="text-muted">
              /
            </span>
          </li>
        ))}
        {last ? (
          <li className="min-w-0" aria-current="page">
            {heading ? (
              <h1 className="m-0 truncate text-[1.15rem] font-semibold leading-7 tracking-tight text-foreground">{last.label}</h1>
            ) : (
              <span className="truncate font-semibold text-foreground">{last.label}</span>
            )}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

export type ViewItem = { key: string; label: string; icon: IconName; href: string; active: boolean };

/** List / Kanban / Calendar switcher: icon buttons, the label is read out and shown on hover. */
export function ViewSwitcher({ label = "View", items }: { label?: string; items: ViewItem[] }) {
  return (
    <nav aria-label={label} className="inline-flex overflow-hidden rounded-md border border-field bg-surface">
      {items.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          title={v.label}
          aria-current={v.active ? "page" : undefined}
          className={cn(
            "inline-flex size-9 items-center justify-center border-l border-field first:border-l-0",
            v.active ? "bg-primary-soft text-primary-ink" : "text-muted hover:bg-background hover:text-foreground",
          )}
        >
          <Icon name={v.icon} size={17} />
          <span className="sr-only">{v.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Odoo's "1-25 / 120  < >" pager. */
export function CompactPager({ from, to, total, prevHref, nextHref }: { from: number; to: number; total: number; prevHref?: string; nextHref?: string }) {
  if (total === 0) return null;
  const btn = "inline-flex size-8 items-center justify-center rounded-md border border-field bg-surface";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5 text-[13px] text-body">
      <span className="tabular-nums">
        {from}-{to} / {total}
      </span>
      {prevHref ? (
        <Link href={prevHref} className={cn(btn, "hover:bg-background")} aria-label="Previous page">
          <Icon name="chevronLeft" size={15} />
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")} aria-hidden="true">
          <Icon name="chevronLeft" size={15} />
        </span>
      )}
      {nextHref ? (
        <Link href={nextHref} className={cn(btn, "hover:bg-background")} aria-label="Next page">
          <Icon name="chevronRight" size={15} />
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")} aria-hidden="true">
          <Icon name="chevronRight" size={15} />
        </span>
      )}
    </nav>
  );
}

/**
 * The strip under the top bar on every screen. Row 1: breadcrumbs (the last one is the page heading) and the
 * search box. Row 2: primary actions on the left; quick filters, pager and view switcher on the right.
 */
export function ControlPanel({
  crumbs,
  heading = true,
  actions,
  search,
  filters,
  pager,
  views,
  description,
}: {
  crumbs: Crumb[];
  /** false on record pages, where the record's name in the sheet is the heading. */
  heading?: boolean;
  actions?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  pager?: ReactNode;
  views?: ReactNode;
  description?: ReactNode;
}) {
  const row2 = actions || filters || pager || views;
  return (
    <section data-control-panel aria-label="Control panel" className="-mx-3 -mt-4 mb-1 border-b border-border bg-surface px-3 pb-2.5 pt-3 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <Breadcrumbs crumbs={crumbs} heading={heading} />
          {description ? <p className="m-0 mt-0.5 max-w-3xl text-[13px] text-muted">{description}</p> : null}
        </div>
        {search ? <div className="w-full md:w-[min(480px,46%)]">{search}</div> : null}
      </div>
      {row2 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            {filters}
            {pager}
            {views}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ record (form) view */

export type Stage = { key: string; label: string; state: "done" | "current" | "todo"; control?: ReactNode };

/** Classes for one stage chevron; pages that let you click a stage render a button with these classes. */
export function stageClass(state: Stage["state"], clickable = false): string {
  return cn(
    "relative -ml-2 inline-flex h-8 items-center whitespace-nowrap pl-5 pr-4 text-[12.5px] font-medium [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,10px_50%)] first:ml-0 first:pl-4 first:[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]",
    state === "current" ? "bg-primary text-white" : state === "done" ? "bg-primary-soft text-primary-ink" : "bg-[#eceeec] text-body",
    clickable && state !== "current" && "cursor-pointer hover:bg-[#dfe5e0]",
  );
}

/** Odoo's status bar: the stages in order, the current one highlighted. A stage with a `control` can be clicked. */
export function StatusBar({ label = "Stage", stages }: { label?: string; stages: Stage[] }) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-wrap items-center p-0">
      {stages.map((s) => (
        <li key={s.key} className="flex" aria-current={s.state === "current" ? "step" : undefined}>
          {s.control ?? <span className={stageClass(s.state)}>{s.label}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * A record page. `actions` (buttons) and `statusbar` sit on a bar above the white sheet; the chatter is a
 * column to the right on wide screens and below the sheet otherwise.
 */
export function FormView({
  crumbs,
  toolbar,
  actions,
  statusbar,
  chatter,
  children,
}: {
  crumbs: Crumb[];
  /** Extra controls in the control panel (e.g. Edit, pager between records). */
  toolbar?: ReactNode;
  actions?: ReactNode;
  statusbar?: ReactNode;
  chatter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ControlPanel crumbs={crumbs} heading={false} actions={toolbar} />
      <div className={cn("grid gap-5", chatter ? "xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]" : undefined)}>
        <div className="min-w-0">
          {actions || statusbar ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-b-0 border-border bg-surface px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
              {statusbar ? <div className="ml-auto">{statusbar}</div> : null}
            </div>
          ) : null}
          <article
            data-sheet
            className={cn(
              "border border-border bg-surface px-4 py-5 shadow-[var(--elev-1)] sm:px-8 sm:py-7",
              // Cards inside the sheet become Odoo's flat groups: a title over a thin rule, no second card.
              "[&_[data-section-card]]:mt-2 [&_[data-section-card]]:rounded-none [&_[data-section-card]]:border-0 [&_[data-section-card]]:border-t [&_[data-section-card]]:px-0 [&_[data-section-card]]:pb-0 [&_[data-section-card]]:pt-4 [&_[data-section-card]]:shadow-none",
              actions || statusbar ? "rounded-b-xl" : "rounded-xl",
            )}
          >
            {children}
          </article>
        </div>
        {chatter ? <div className="min-w-0">{chatter}</div> : null}
      </div>
    </>
  );
}

/** The record's name at the top of the sheet, with its code above it and any badges after it. */
export function SheetTitle({ code, title, badges, smart }: { code?: string; title: string; badges?: ReactNode; smart?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col-reverse gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {code ? <p className="m-0 text-[13px] font-medium text-muted">{code}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="m-0 text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
          {badges}
        </div>
      </div>
      {smart}
    </div>
  );
}

export type SmartItem = { icon: IconName; value: ReactNode; label: string; href?: string; tone?: "danger" };

/** The stat buttons in the sheet's top right ("5 Tasks", "INR 12,000 Unpaid"). */
export function SmartButtons({ items }: { items: SmartItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-start gap-0 overflow-hidden rounded-lg border border-border lg:justify-end">
      {items.map((s) => {
        const inner = (
          <>
            <Icon name={s.icon} size={20} className={s.tone === "danger" ? "text-danger" : "text-primary"} />
            <span className="flex flex-col leading-tight">
              <span className={cn("text-[15px] font-semibold tabular-nums", s.tone === "danger" ? "text-danger" : "text-foreground")}>{s.value}</span>
              <span className="text-[12px] text-muted">{s.label}</span>
            </span>
          </>
        );
        const cls = "flex min-w-[124px] items-center gap-2.5 border-l border-border px-3.5 py-2 first:border-l-0";
        return s.href ? (
          <Link key={s.label} href={s.href} className={cn(cls, "hover:bg-background")}>
            {inner}
          </Link>
        ) : (
          <div key={s.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Odoo's two-column field groups: bold label on the left, value on the right. */
export function FieldGrid({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 }) {
  return (
    <dl className={cn("m-0 grid gap-x-10 gap-y-0", columns === 2 && "md:grid-cols-2")}>
      {items.map((f) => (
        <div key={f.label} className="grid grid-cols-[minmax(110px,38%)_minmax(0,1fr)] items-baseline gap-3 border-b border-border/70 py-2 text-sm">
          <dt className="font-semibold text-foreground">{f.label}</dt>
          <dd className="m-0 min-w-0 break-words text-body">{f.value ?? <span className="text-muted">-</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export type NotebookTab = { key: string; label: string; href: string; active: boolean; count?: number };

/** The notebook tabs under a record's fields. They are links, so every tab has its own URL. */
export function NotebookTabs({ label, tabs }: { label: string; tabs: NotebookTab[] }) {
  return (
    <nav aria-label={label} className="mb-4 mt-6 flex overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-sm font-medium",
            t.active ? "border-primary text-primary-ink" : "border-transparent text-muted hover:border-field hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** The white sheet a create/edit form sits on. In a pop-up it drops its own border (the pop-up is the sheet). */
export const sheetClass = "rounded-xl border border-border bg-surface p-5 shadow-[var(--elev-1)] sm:p-7";
