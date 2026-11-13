import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getPreferences } from "@/modules/settings";
import { PreferencesForm } from "./preferences-form";

export const metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const actor = await requireActor();
  return <PreferencesForm prefs={await getPreferences(actor)} canEdit={can(actor, "settings.manage")} />;
}
