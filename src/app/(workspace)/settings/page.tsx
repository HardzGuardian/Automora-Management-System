import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";

export default async function SettingsIndex() {
  const actor = await requireActor();
  redirect(can(actor, "settings.read") ? "/settings/company" : "/settings/roles");
}
