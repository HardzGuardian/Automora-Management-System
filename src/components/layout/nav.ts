// Navigation model. Hiding an item is a convenience only; every service still enforces permissions.
export type NavItem = { href: string; label: string; anyOf?: readonly string[] };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/my-tasks", label: "My tasks" },
      { href: "/tasks", label: "All tasks" },
      { href: "/projects", label: "Projects" },
      { href: "/clients", label: "Clients", anyOf: ["clients.read"] },
      { href: "/employees", label: "Employees", anyOf: ["employees.read"] },
      { href: "/teams", label: "Teams" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", anyOf: ["finance.invoices.read"] },
      { href: "/payments", label: "Payments", anyOf: ["finance.payments.read"] },
      { href: "/expenses", label: "Expenses", anyOf: ["finance.expenses.read"] },
      { href: "/finance-reports", label: "Finance reports", anyOf: ["finance.reports.read"] },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/reports", label: "Reports", anyOf: ["reports.all.read", "reports.limited.read", "reports.personal.read"] },
      { href: "/notifications", label: "Notifications" },
      { href: "/settings", label: "Settings", anyOf: ["settings.read", "roles.read"] },
      { href: "/profile", label: "My account" },
    ],
  },
];

export function visibleNav(permissions: ReadonlySet<string>): NavGroup[] {
  return NAV.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => !i.anyOf || i.anyOf.some((p) => permissions.has(p))),
  })).filter((g) => g.items.length > 0);
}

const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.href.slice(1), i.label])));
Object.assign(TITLES, { new: "New", calendar: "Calendar", company: "Company", preferences: "Preferences", roles: "Roles & permissions", numbering: "Numbering" });

/** Breadcrumbs from a pathname. UUID-like segments become "Details". */
export function breadcrumbs(pathname: string): { href: string; label: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((p, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(p) ? "Details" : (TITLES[p] ?? p.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())),
  }));
}
