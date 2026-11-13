"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { NavGroup } from "./nav";
import { BellIcon, NavIcon } from "./nav-icons";

export type ShellUser = { name: string; email: string; roles: string[] };

function NavList({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{g.label}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm",
                      active ? "bg-primary-soft font-semibold text-primary" : "text-foreground hover:bg-primary-soft",
                    )}
                  >
                    <NavIcon href={i.href} className={active ? "text-primary" : "text-muted"} />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ProfileMenu({ user, signOut }: { user: ShellUser; signOut: () => Promise<void> }) {
  return (
    <details className="relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 hover:bg-primary-soft">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-muted">{user.roles.join(", ") || "No role"}</span>
        </span>
        <span className="sr-only">Account menu</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-60 rounded-md border border-border bg-surface p-2 shadow-lg">
        <p className="px-2 py-1 text-sm font-medium">{user.name}</p>
        <p className="truncate px-2 pb-2 text-xs text-muted">{user.email}</p>
        <Link href="/profile" className="flex min-h-10 items-center rounded-md px-2 text-sm hover:bg-primary-soft">
          My account
        </Link>
        <form action={signOut}>
          <button type="submit" className="flex min-h-10 w-full items-center rounded-md px-2 text-left text-sm hover:bg-primary-soft">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export function AppShell({
  groups,
  user,
  unread,
  signOut,
  children,
}: {
  groups: NavGroup[];
  user: ShellUser;
  unread: number;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The drawer is "open for" a pathname, so navigating anywhere closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = useCallback((v: boolean) => setOpenFor(v ? pathname : null), [pathname]);

  // Close on Escape.
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

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-3 lg:flex">
        <Link href="/dashboard" className="px-3 pt-2 text-lg font-bold text-primary">
          Automora
        </Link>
        <NavList groups={groups} pathname={pathname} />
      </aside>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-surface p-3 shadow-lg">
            <div className="flex items-center justify-between px-3 pt-2">
              <span className="text-lg font-bold text-primary">Automora</span>
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-md px-3 text-sm hover:bg-primary-soft">
                Close
              </button>
            </div>
            <NavList groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
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
            className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-primary-soft lg:hidden"
          >
            Menu
          </button>
          <form action="/search" role="search" className="mx-auto hidden w-full max-w-md sm:block">
            <input
              name="q"
              type="search"
              aria-label="Search"
              placeholder="Search employees, clients, projects, tasks"
              className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/notifications" className="relative flex min-h-10 items-center gap-2 rounded-md px-3 text-sm hover:bg-primary-soft">
              <BellIcon className="text-muted" />
              <span className="sr-only sm:not-sr-only">Notifications</span>
              {unread > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </Link>
            <ProfileMenu user={user} signOut={signOut} />
          </div>
        </header>


        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
