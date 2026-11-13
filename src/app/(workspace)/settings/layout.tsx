import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const settings = can(actor, "settings.read");
  const roles = can(actor, "roles.read");
  const users = can(actor, "users.read");
  const security = can(actor, "audit.read");
  if (!settings && !roles && !users && !security) notFound();
  const tabs = [
    settings && { href: "/settings/company", label: "Company" },
    settings && { href: "/settings/preferences", label: "Preferences" },
    users && { href: "/settings/users", label: "Users" },
    roles && { href: "/settings/roles", label: "Roles & permissions" },
    settings && { href: "/settings/numbering", label: "Numbering" },
    security && { href: "/settings/security", label: "Security" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" />
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  );
}
