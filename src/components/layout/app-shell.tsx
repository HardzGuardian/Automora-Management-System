"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { isActive, type NavItem, type Tone } from "./nav";
import { QuickTaskButton, type QuickTaskActions } from "./quick-task-panel";

export type ShellUser = { name: string; email: string; roles: string[] };

const COLLAPSE_KEY = "automora.sidebar.collapsed";

/** Icon chip colors: soft at rest, solid for the current module. Full class names so Tailwind finds them. */
const CHIP: Record<Tone, { rest: string; on: string; row: string }> = {
  green: { rest: "bg-[var(--tone-green-soft)] text-[var(--tone-green)]", on: "bg-[var(--tone-green)] text-white", row: "bg-[var(--tone-green-soft)]" },
  blue: { rest: "bg-[var(--tone-blue-soft)] text-[var(--tone-blue)]", on: "bg-[var(--tone-blue)] text-white", row: "bg-[var(--tone-blue-soft)]" },
  amber: { rest: "bg-[var(--tone-amber-soft)] text-[var(--tone-amber)]", on: "bg-[var(--tone-amber)] text-white", row: "bg-[var(--tone-amber-soft)]" },
  teal: { rest: "bg-[var(--tone-teal-soft)] text-[var(--tone-teal)]", on: "bg-[var(--tone-teal)] text-white", row: "bg-[var(--tone-teal-soft)]" },
  rose: { rest: "bg-[var(--tone-rose-soft)] text-[var(--tone-rose)]", on: "bg-[var(--tone-rose)] text-white", row: "bg-[var(--tone-rose-soft)]" },
  slate: { rest: "bg-[var(--tone-slate-soft)] text-[var(--tone-slate)]", on: "bg-[var(--tone-slate)] text-white", row: "bg-[var(--tone-slate-soft)]" },
};

/** The child page that best matches the address: the one that agrees on the most query values. */
function bestChild(item: NavItem, pathname: string, params: URLSearchParams): string | null {
  let best: { href: string; score: number } | null = null;
  for (const k of item.children ?? []) {
    const [path, query = ""] = k.href.split("?");
    if (path !== pathname) continue;
    const want = new URLSearchParams(query);
    let ok = true;
    for (const [key, value] of want) if (params.get(key) !== value) ok = false;
    if (!ok) continue;
    const score = [...want].length;
    if (!best || score > best.score) best = { href: k.href, score };
  }
  return best?.href ?? null;
}

function NavRow({ item, pathname, params, collapsed, onNavigate }: { item: NavItem; pathname: string; params: URLSearchParams; collapsed: boolean; onNavigate?: () => void }) {
  const active = isActive(item, pathname);
  const tone = CHIP[item.tone ?? "slate"];
  const kids = item.children ?? [];
  const current = active ? bestChild(item, pathname, params) : null;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group flex min-h-10 items-center gap-3 rounded-xl px-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          active ? cn(tone.row, "text-foreground") : "text-body hover:bg-background hover:text-foreground",
        )}
      >
        <span className={cn("inline-flex size-8 flex-none items-center justify-center rounded-lg transition-colors", active ? tone.on : tone.rest)}>
          <Icon name={item.icon} size={17} />
        </span>
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>{item.label}</span>
      </Link>
      {active && kids.length > 0 && !collapsed ? (
        <ul className="m-0 mb-1 ml-[19px] mt-0.5 list-none border-l border-border p-0 pl-3">
          {kids.map((k) => (
            <li key={k.href}>
              <Link
                href={k.href}
                onClick={onNavigate}
                aria-current={current === k.href ? "page" : undefined}
                className={cn(
                  "flex min-h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors",
                  current === k.href ? "bg-surface font-semibold text-foreground shadow-[var(--elev-1)]" : "text-muted hover:bg-background hover:text-foreground",
                )}
              >
                {k.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label={collapsed ? "Automora" : undefined}>
      <span aria-hidden="true" className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-white shadow-[var(--elev-2)]">A</span>
      {collapsed ? null : <span className="text-[17px] font-bold tracking-tight text-foreground">Automora</span>}
    </Link>
  );
}

function SidebarNav({
  main,
  settings,
  pathname,
  params,
  collapsed,
  onNavigate,
}: {
  main: NavItem[];
  settings: NavItem | null;
  pathname: string;
  params: URLSearchParams;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of main) {
    const name = item.group ?? "Workspace";
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(item);
    else groups.push({ name, items: [item] });
  }
  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col justify-between gap-4">
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.name}>
            {collapsed ? <div className="mx-3 mb-1 h-px bg-border" /> : <p className="m-0 mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{g.name}</p>}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {g.items.map((i) => (
                <NavRow key={i.href} item={i} pathname={pathname} params={params} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {settings ? (
        <ul className="m-0 list-none border-t border-border p-0 pt-3">
          <NavRow item={settings} pathname={pathname} params={params} collapsed={collapsed} onNavigate={onNavigate} />
        </ul>
      ) : null}
    </nav>
  );
}

export function AppShell({
  main,
  settings,
  user,
  unread,
  quickTask,
  children,
}: {
  main: NavItem[];
  settings: NavItem | null;
  user: ShellUser;
  unread: number;
  /** Admin-only: when given, the top bar shows the quick "New task" panel. */
  quickTask: QuickTaskActions | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  // The drawer is "open for" a pathname, so navigating anywhere closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = useCallback((v: boolean) => setOpenFor(v ? pathname : null), [pathname]);

  // The collapsed choice is a per-person convenience; the page renders fine without it.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage is only possible after mount
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage blocked: stay expanded */
    }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar: 248px, or a 76px icon rail when collapsed */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface p-3 lg:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex min-h-10 items-center", collapsed ? "flex-col gap-2" : "justify-between px-1")}>
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground"
          >
            <Icon name="panel" size={17} />
          </button>
        </div>
        <SidebarNav main={main} settings={settings} pathname={pathname} params={params} collapsed={collapsed} />
      </aside>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-surface p-3">
            <div className="flex min-h-11 items-center justify-between px-1">
              <Brand collapsed={false} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-10 items-center justify-center rounded-lg hover:bg-background">
                <Icon name="close" />
              </button>
            </div>
            <SidebarNav main={main} settings={settings} pathname={pathname} params={params} collapsed={false} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-10 items-center justify-center rounded-lg border border-field hover:bg-background lg:hidden"
          >
            <Icon name="panel" />
          </button>

          <form action="/search" role="search" className="relative hidden w-full max-w-md sm:block">
            <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              aria-label="Search"
              placeholder="Search projects, tasks, documents..."
              className="h-10 w-full rounded-full border border-transparent bg-background pl-10 pr-4 text-sm placeholder:text-muted focus:border-primary focus:bg-surface"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {quickTask ? <QuickTaskButton actions={quickTask} /> : null}
            <Link href="/notifications" className="relative flex size-10 items-center justify-center rounded-full text-body hover:bg-background">
              <Icon name="bell" size={19} />
              <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
              {unread > 0 ? (
                <span aria-hidden="true" className="absolute right-1 top-1 inline-flex min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10.5px] font-semibold leading-[17px] text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Link href="/profile" title={user.name} className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-background">
              <span
                aria-hidden="true"
                data-initial={user.name.slice(0, 1).toUpperCase()}
                className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white before:content-[attr(data-initial)]"
              />
              <span className="sr-only">My account: </span>
              <span className="max-w-[140px] truncate text-sm font-medium text-foreground max-md:sr-only">{user.name}</span>
            </Link>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-3 pb-10 pt-5 sm:px-8">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
