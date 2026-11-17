"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { isActive, type NavItem } from "./nav";
import { QuickTaskButton, type QuickTaskActions } from "./quick-task-panel";

export type ShellUser = { name: string; email: string; roles: string[] };

const COLLAPSE_KEY = "automora.sidebar.collapsed";

function NavLink({ item, pathname, collapsed, onNavigate }: { item: NavItem; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
        collapsed && "justify-center px-0",
        active ? "bg-primary-soft font-semibold text-primary-ink" : "text-body hover:bg-primary-soft",
      )}
    >
      <Icon name={item.icon} className={active ? "text-primary" : "text-muted"} />
      <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
    </Link>
  );
}

function Sidebar({
  main,
  settings,
  pathname,
  collapsed,
  onNavigate,
}: {
  main: NavItem[];
  settings: NavItem | null;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col justify-between gap-6">
      <ul className="flex flex-col gap-1">
        {main.map((i) => (
          <li key={i.href}>
            <NavLink item={i} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
      {settings ? <NavLink item={settings} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} /> : null}
    </nav>
  );
}

function Avatar({ user }: { user: ShellUser }) {
  return (
    <Link
      href="/profile"
      aria-label={`My account (${user.name})`}
      className="inline-flex size-11 items-center justify-center rounded-full bg-primary font-semibold text-white hover:bg-primary-hover"
    >
      {user.name.slice(0, 1).toUpperCase()}
    </Link>
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

      {/* Desktop sidebar: 248px, or 76px when collapsed to icons */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-3 lg:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex min-h-11 items-center", collapsed ? "justify-center" : "justify-between px-2")}>
          {collapsed ? null : (
            <Link href="/dashboard" className="text-lg font-bold text-primary-ink">
              Automora
            </Link>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-primary-soft"
          >
            <Icon name="panel" />
          </button>
        </div>
        <Sidebar main={main} settings={settings} pathname={pathname} collapsed={collapsed} />
      </aside>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-surface p-3">
            <div className="flex min-h-11 items-center justify-between px-2">
              <span className="text-lg font-bold text-primary-ink">Automora</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-md hover:bg-primary-soft">
                <Icon name="close" />
              </button>
            </div>
            <Sidebar main={main} settings={settings} pathname={pathname} collapsed={false} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-11 items-center justify-center rounded-md border border-field hover:bg-primary-soft lg:hidden"
          >
            <Icon name="panel" />
          </button>

          <form action="/search" role="search" className="relative mx-auto hidden w-full max-w-lg sm:block">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              aria-label="Search"
              placeholder="Search projects, tasks, documents"
              className="min-h-11 w-full rounded-md border border-field bg-background pl-10 pr-3 text-sm placeholder:text-muted"
            />
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {quickTask ? <QuickTaskButton actions={quickTask} /> : null}
            <Link href="/notifications" className="relative flex size-11 items-center justify-center rounded-md hover:bg-primary-soft">
              <Icon name="bell" className="text-body" />
              <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-[18px] text-white"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Avatar user={user} />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
