import { ControlPanel } from "@/components/ui/odoo";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
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
    users && { href: "/settings/users", label: "Users" },
    can(actor, "employees.read") && { href: "/employees", label: "Employees" },
    roles && { href: "/settings/roles", label: "Roles and permissions" },
    settings && { href: "/settings/numbering", label: "Numbering" },
    settings && { href: "/settings/preferences", label: "Preferences" },
    security && { href: "/settings/audit", label: "Audit log" },
    security && { href: "/settings/security", label: "Security" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div className="flex flex-col gap-5">
      <ControlPanel
        crumbs={[{ label: "Settings" }]}
        description={<>Company details, people and what each role can do.</>}
      />
      <div className="flex flex-wrap items-start gap-6">
        <SettingsTabs tabs={tabs} />
        <div className="min-w-0 flex-[1_1_520px]">{children}</div>
      </div>
    </div>
  );
}
