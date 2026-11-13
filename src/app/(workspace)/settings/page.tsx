import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";

// Send people to the first settings section they can actually open.
export default async function SettingsIndex() {
  const actor = await requireActor();
  if (can(actor, "settings.read")) redirect("/settings/company");
  if (can(actor, "users.read")) redirect("/settings/users");
  redirect("/settings/roles");
}
