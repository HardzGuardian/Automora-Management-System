import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const settings = can(actor, "settings.read");
  const roles = can(actor, "roles.read");
  const users = can(actor, "users.read");
  if (!settings && !roles && !users) notFound();
  const tabs = [
    settings && { href: "/settings/company", label: "Company" },
    settings && { href: "/settings/preferences", label: "Preferences" },
    users && { href: "/settings/users", label: "Users" },
    roles && { href: "/settings/roles", label: "Roles & permissions" },
    settings && { href: "/settings/numbering", label: "Numbering" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-border pb-2 text-sm">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-md px-3 py-2 hover:bg-primary-soft">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
