"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { isActive, type NavItem } from "./nav";
import { QuickTaskButton, type QuickTaskActions } from "./quick-task-panel";

export type ShellUser = { name: string; email: string; roles: string[] };

/**
 * One module in the Odoo-style top bar. The name is a link to the module's home page; when the module has
 * several pages, a small chevron button next to it opens a dropdown with them.
 */
function ModuleMenu({ item, pathname, open, onToggle, onClose }: { item: NavItem; pathname: string; open: boolean; onToggle: () => void; onClose: () => void }) {
  const active = isActive(item, pathname);
  const kids = item.children ?? [];
  return (
    <li className="relative flex items-stretch">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center whitespace-nowrap px-2.5 text-[13.5px] font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white",
          active && "bg-white/15 text-white",
          kids.length > 0 && "pr-1",
        )}
      >
        {item.label}
      </Link>
      {kids.length > 0 ? (
        <>
          <button
            type="button"
            aria-label={`${item.label} menu`}
            aria-expanded={open}
            onClick={onToggle}
            className={cn("flex items-center px-0.5 text-white/70 hover:bg-white/10 hover:text-white", (active || open) && "bg-white/15 text-white")}
          >
            <Icon name="chevronDown" size={14} strokeWidth={2.4} className={cn("transition-transform", open && "rotate-180")} />
          </button>
          {open ? (
            <ul className="absolute left-0 top-full z-40 m-0 min-w-[210px] list-none rounded-b-lg border border-border bg-surface p-1 text-foreground shadow-[var(--elev-3)]">
              {kids.map((k) => (
                <li key={k.href}>
                  <Link href={k.href} onClick={onClose} className="flex min-h-9 items-center gap-2.5 rounded-md px-3 text-sm hover:bg-primary-soft">
                    <Icon name={k.icon} size={16} className="text-muted" />
                    {k.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/** The mobile/tablet drawer: every module with its pages listed underneath. */
function DrawerNav({ main, settings, pathname, onNavigate }: { main: NavItem[]; settings: NavItem | null; pathname: string; onNavigate: () => void }) {
  const items = settings ? [...main, settings] : main;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <div key={item.href} className="flex flex-col">
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium", active ? "bg-primary-soft text-primary-ink" : "text-body hover:bg-background")}
            >
              <Icon name={item.icon} className={active ? "text-primary" : "text-muted"} />
              {item.label}
            </Link>
            {item.children?.some((k) => k.href !== item.href) ? (
              <ul className="m-0 ml-9 list-none border-l border-border p-0 pl-2">
                {item.children.filter((k) => k.href !== item.href).map((k) => (
                  <li key={k.href}>
                    <Link href={k.href} onClick={onNavigate} className="flex min-h-10 items-center rounded-md px-2 text-[13px] text-body hover:bg-background">
                      {k.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
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
  // The drawer is "open for" a pathname, so navigating anywhere closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = useCallback((v: boolean) => setOpenFor(v ? pathname : null), [pathname]);

  // Which module dropdown is open (by href), also tied to the page so navigating closes it.
  const [menu, setMenu] = useState<{ href: string; path: string } | null>(null);
  const openMenu = menu && menu.path === pathname ? menu.href : null;
  const bar = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [setOpen]);

  const topItems = settings ? [...main, settings] : main;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header ref={bar} className="sticky top-0 z-30 flex h-12 items-stretch gap-1 bg-brand-deep px-2 text-white shadow-[0_1px_0_rgb(0_0_0/0.15)] sm:px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="my-auto flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10 xl:hidden"
        >
          <Icon name="apps" size={20} />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 px-2 text-[15px] font-bold tracking-tight text-white">
          <Icon name="apps" size={18} className="hidden text-white/80 2xl:block" />
          Automora
        </Link>

        <nav aria-label="Main" className="hidden items-stretch xl:flex">
          <ul className="m-0 flex list-none items-stretch p-0">
            {topItems.map((item) => (
              <ModuleMenu
                key={item.href}
                item={item}
                pathname={pathname}
                open={openMenu === item.href}
                onToggle={() => setMenu(openMenu === item.href ? null : { href: item.href, path: pathname })}
                onClose={() => setMenu(null)}
              />
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex flex-none items-center gap-1">
          <form action="/search" role="search" className="relative hidden md:block">
            <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              name="q"
              type="search"
              aria-label="Search"
              placeholder="Search..."
              className="h-8 w-36 rounded-md border border-white/20 bg-white/10 pl-8 pr-2 text-[13px] text-white placeholder:text-white/55 focus:w-56 focus:bg-white focus:text-foreground focus:placeholder:text-muted 2xl:w-52"
            />
          </form>
          {quickTask ? <QuickTaskButton actions={quickTask} /> : null}
          <Link href="/notifications" className="relative flex size-10 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white">
            <Icon name="bell" size={19} />
            <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
            {unread > 0 ? (
              <span aria-hidden="true" className="absolute right-1 top-1 inline-flex min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10.5px] font-semibold leading-[17px] text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            href="/profile"
            aria-label={`My account (${user.name})`}
            title={user.name}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-white/90 hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white ring-2 ring-white/25">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span aria-hidden="true" className="hidden max-w-[140px] truncate text-[13px] 2xl:block">
              {user.name}
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-surface p-3">
            <div className="flex min-h-11 items-center justify-between px-2">
              <span className="text-lg font-bold text-primary-ink">Automora</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-md hover:bg-primary-soft">
                <Icon name="close" />
              </button>
            </div>
            <DrawerNav main={main} settings={settings} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-3 pb-8 pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
