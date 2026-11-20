import type { IconName } from "@/components/ui/icons";

// Navigation model (the "Automora redesign" canvas): one flat list, Settings pinned at the bottom.
// Hiding an item is a convenience only; every service still enforces permissions.
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Shown when the user has ANY of these permissions. No list = everyone. */
  anyOf?: readonly string[];
  /** Other path prefixes that also count as "being in" this section (e.g. Finance spans several lists). */
  match?: readonly string[];
};

export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/tasks", label: "Tasks", icon: "tasks", match: ["/my-tasks"] },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/clients", label: "Clients", icon: "clients", anyOf: ["clients.read"] },
  { href: "/teams", label: "Team", icon: "team", match: ["/employees"] },
  {
    href: "/finance",
    label: "Finance",
    icon: "finance",
    anyOf: ["finance.invoices.read", "finance.payments.read", "finance.expenses.read", "finance.reports.read", "reports.all.read", "reports.limited.read", "reports.personal.read"],
    match: ["/invoices", "/payments", "/expenses", "/finance-reports", "/reports"],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: "settings",
  anyOf: ["settings.read", "roles.read", "users.read", "audit.read"],
};

const allowed = (i: NavItem, permissions: ReadonlySet<string>) => !i.anyOf || i.anyOf.some((p) => permissions.has(p));

/** Finance holds the reports too. Someone with report access only sees it as "Reports". */
const asSeen = (i: NavItem, permissions: ReadonlySet<string>): NavItem =>
  i.href === "/finance" && !i.anyOf?.some((p) => p.startsWith("finance.") && permissions.has(p)) ? { ...i, label: "Reports", icon: "reports" } : i;

export function visibleNav(permissions: ReadonlySet<string>): { main: NavItem[]; settings: NavItem | null } {
  return {
    main: NAV.filter((i) => allowed(i, permissions)).map((i) => asSeen(i, permissions)),
    settings: allowed(SETTINGS_ITEM, permissions) ? SETTINGS_ITEM : null,
  };
}

/** Is `pathname` inside this item's section? */
export function isActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
