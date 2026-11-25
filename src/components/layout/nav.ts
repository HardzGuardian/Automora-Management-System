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
  /** The module's own pages, listed under it in the sidebar while you are inside the module. */
  children?: readonly NavItem[];
  /** Soft accent for the icon chip. */
  tone?: Tone;
  /** Sidebar section heading this item sits under. */
  group?: "Workspace" | "People" | "Money";
};

export type Tone = "green" | "blue" | "amber" | "teal" | "rose" | "slate";

export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", tone: "green", group: "Workspace" },
  {
    href: "/projects",
    label: "Projects",
    icon: "projects",
    tone: "blue",
    group: "Workspace",
    children: [
      { href: "/projects", label: "All projects", icon: "projects" },
    ],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: "tasks",
    tone: "green",
    group: "Workspace",
    match: ["/my-tasks"],
    children: [
      { href: "/tasks", label: "All tasks", icon: "tasks", anyOf: ["tasks.read.all"] },
      { href: "/tasks?show=mine", label: "My tasks", icon: "tasks" },
      { href: "/tasks?show=overdue", label: "Overdue", icon: "overdue" },
    ],
  },
  { href: "/documents", label: "Documents", icon: "documents", tone: "slate", group: "Workspace" },
  {
    href: "/clients",
    label: "Clients",
    icon: "clients",
    tone: "amber",
    group: "People",
    anyOf: ["clients.read"],
    children: [
      { href: "/clients", label: "All clients", icon: "clients" },
    ],
  },
  {
    href: "/employees",
    label: "Employees",
    icon: "employees",
    tone: "teal",
    group: "People",
    anyOf: ["employees.read"],
    children: [
      { href: "/employees", label: "All employees", icon: "employees" },
    ],
  },
  {
    href: "/teams",
    label: "Team",
    icon: "team",
    tone: "rose",
    group: "People",
    children: [
      { href: "/teams", label: "Teams", icon: "team" },
    ],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: "finance",
    tone: "amber",
    group: "Money",
    anyOf: ["finance.invoices.read", "finance.payments.read", "finance.expenses.read", "finance.reports.read", "reports.all.read", "reports.limited.read", "reports.personal.read"],
    match: ["/invoices", "/payments", "/expenses", "/finance-reports", "/reports"],
    children: [
      { href: "/finance?tab=invoices", label: "Invoices", icon: "issued", anyOf: ["finance.invoices.read"] },
      { href: "/finance?tab=payments", label: "Payments", icon: "finance", anyOf: ["finance.payments.read"] },
      { href: "/finance?tab=expenses", label: "Expenses", icon: "partial", anyOf: ["finance.expenses.read"] },
      { href: "/expenses/categories", label: "Expense categories", icon: "settings", anyOf: ["finance.categories.manage"] },
      { href: "/finance-reports", label: "Finance reports", icon: "reports", anyOf: ["finance.reports.read"] },
      { href: "/reports", label: "Work reports", icon: "reports", anyOf: ["reports.all.read", "reports.limited.read", "reports.personal.read"] },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: "settings",
  tone: "slate",
  anyOf: ["settings.read", "roles.read", "users.read", "audit.read"],
};

const allowed = (i: NavItem, permissions: ReadonlySet<string>) => !i.anyOf || i.anyOf.some((p) => permissions.has(p));

/** Finance holds the reports too. Someone with report access only sees it as "Reports". */
const asSeen = (i: NavItem, permissions: ReadonlySet<string>): NavItem =>
  i.href === "/finance" && !i.anyOf?.some((p) => p.startsWith("finance.") && permissions.has(p)) ? { ...i, label: "Reports", icon: "reports" } : i;

/** The item with only the dropdown entries this person may open (a lone entry is dropped: the module link is enough). */
const withChildren = (i: NavItem, permissions: ReadonlySet<string>): NavItem => {
  const kids = (i.children ?? []).filter((c) => allowed(c, permissions));
  return { ...i, children: kids.length > 1 ? kids : undefined };
};

export function visibleNav(permissions: ReadonlySet<string>): { main: NavItem[]; settings: NavItem | null } {
  return {
    main: NAV.filter((i) => allowed(i, permissions)).map((i) => withChildren(asSeen(i, permissions), permissions)),
    settings: allowed(SETTINGS_ITEM, permissions) ? SETTINGS_ITEM : null,
  };
}

/** Is `pathname` inside this item's section? */
export function isActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
