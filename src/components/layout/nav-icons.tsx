import type { ReactNode } from "react";

// Hand-drawn 16px outline icons, one per nav destination. Decorative: the label next to them carries the meaning.
const PATHS: Record<string, ReactNode> = {
  "/dashboard": (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="3.5" rx="1" />
      <rect x="9" y="7.5" width="5" height="6.5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
    </>
  ),
  "/my-tasks": (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="m5.5 8.2 1.8 1.8 3.2-3.5" />
    </>
  ),
  "/tasks": (
    <>
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
      <circle cx="2.8" cy="4" r=".6" />
      <circle cx="2.8" cy="8" r=".6" />
      <circle cx="2.8" cy="12" r=".6" />
    </>
  ),
  "/projects": <path d="M1.8 4.2c0-.7.5-1.2 1.2-1.2h3l1.4 1.6H13c.7 0 1.2.5 1.2 1.2v6.2c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z" />,
  "/clients": (
    <>
      <rect x="2" y="5" width="12" height="8.5" rx="1.5" />
      <path d="M6 5V3.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8V5M2 8.5h12" />
    </>
  ),
  "/employees": (
    <>
      <circle cx="6" cy="5.5" r="2.3" />
      <path d="M1.8 13c.3-2.2 2-3.4 4.2-3.4s3.9 1.2 4.2 3.4" />
      <path d="M10.5 3.5a2.2 2.2 0 0 1 0 4.2M12 9.8c1.2.5 2 1.5 2.2 3.2" />
    </>
  ),
  "/teams": (
    <>
      <circle cx="8" cy="4.5" r="1.8" />
      <circle cx="3.6" cy="11.6" r="1.8" />
      <circle cx="12.4" cy="11.6" r="1.8" />
      <path d="M7 6.1 4.6 10M9 6.1 11.4 10M5.4 11.6h5.2" />
    </>
  ),
  "/invoices": (
    <>
      <path d="M3.5 2h6l3 3v9h-9z" />
      <path d="M9.5 2v3h3M5.5 8h5M5.5 10.5h5" />
    </>
  ),
  "/payments": (
    <>
      <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.5" />
      <path d="M1.8 6.5h12.4M4.5 10h2" />
    </>
  ),
  "/expenses": <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1zM6 6h4M6 9h4" />,
  "/finance-reports": <path d="M2.5 13.5h11M4.5 13.5V8M8 13.5V3.5M11.5 13.5V6" />,
  "/reports": (
    <>
      <path d="M8 2.5v5.5h5.5" />
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" />
    </>
  ),
  "/notifications": <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14h3" />,
  "/settings": (
    <>
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </>
  ),
  "/profile": (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.4-2.4 2.3-3.7 5-3.7s4.6 1.3 5 3.7" />
    </>
  ),
};

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const path = PATHS[href];
  if (!path) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );
}

export function BellIcon({ className }: { className?: string }) {
  return <NavIcon href="/notifications" className={className} />;
}
