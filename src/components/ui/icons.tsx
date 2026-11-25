import type { SVGProps } from "react";

/** 24px stroke icons from the "Automora redesign" canvas. Decorative: the text beside them carries the meaning. */
export const PATHS = {
  // navigation
  dashboard: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  tasks: "M9 11l3 3 8-8 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9",
  documents: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6",
  clients: "M3 8h18v11H3z M8 8V5h8v3 M3 13h18",
  // An ID card: one person with their details, for the employee directory.
  employees: "M3 5h18v14H3z M9 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M5.5 16.5a3.5 3.5 0 0 1 7 0 M15 9h3 M15 13h3",
  team: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M21 20v-1a4 4 0 0 0-3-3.9 M16 4.1a3.5 3.5 0 0 1 0 6.8",
  finance: "M3 6h18v12H3z M3 10h18 M7 15h3",
  reports: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  settings: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M16 4v4 M10 10v4 M18 16v4",
  panel: "M3 5h18v14H3z M9 5v14",
  // actions
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5",
  plus: "M12 5v14 M5 12h14",
  bell: "M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7 M10 20a2 2 0 0 0 4 0",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12l5 5 9-10",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 6l-6 6 6 6",
  download: "M12 4v12 M7 11l5 5 5-5 M4 19h16",
  mail: "M3 6h18v12H3z M3 7l9 7 9-7",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  comment: "M4 5h16v11H9l-5 4z",
  warning: "M12 3l10 18H2z M12 10v5 M12 18v.01",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  // Odoo-style shell and control panel
  apps: "M4 4h4v4H4z M10 4h4v4h-4z M16 4h4v4h-4z M4 10h4v4H4z M10 10h4v4h-4z M16 10h4v4h-4z M4 16h4v4H4z M10 16h4v4h-4z M16 16h4v4h-4z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  kanban: "M3 4h5v16H3z M10 4h5v10h-5z M17 4h4v7h-4z",
  calendar: "M3 6h18v15H3z M3 10h18 M8 3v5 M16 3v5",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  groupBy: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
  chevronRight: "M9 6l6 6-6 6",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4 M10 17l-5-5 5-5 M5 12h11",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  // status
  inProgress: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18",
  pending: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v4l3 2",
  review: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  overdue: "M12 3l10 18H2z M12 10v5 M12 18h0",
  completed: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12l3 3 5-6",
  onHold: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M10 9v6 M14 9v6",
  cancelled: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9l6 6 M15 9l-6 6",
  archived: "M3 4h18v4H3z M5 8v11h14V8 M10 12h4",
  draft: "M4 20h4L19 9l-4-4L4 16z M13 7l4 4",
  issued: "M4 12l16-8-6 16-3-7z",
  partial: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3a9 9 0 0 1 0 18z",
  reversed: "M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3",
  suspended: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8",
  inactive: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  dot: "M12 12h0",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
