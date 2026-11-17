import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getCompanyProfile } from "@/modules/settings";
import { CompanyForm } from "./company-form";

export const metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const actor = await requireActor();
  const profile = await getCompanyProfile(actor);
  return <CompanyForm profile={profile} canEdit={can(actor, "settings.manage")} />;
}
