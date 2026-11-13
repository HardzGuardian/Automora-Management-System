"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { createRole, setRolePermissions } from "@/modules/auth";
import { updateCompanyProfile, updatePreferences } from "@/modules/settings";

export type SettingsState = { error?: string; fieldErrors?: Record<string, string[]>; saved?: boolean };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function saveCompanyAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const actor = await requireActor();
  const r = await toActionResult(() =>
    updateCompanyProfile(actor, {
      legalName: str(fd.get("legalName")),
      displayName: str(fd.get("displayName")),
      email: str(fd.get("email")),
      phone: str(fd.get("phone")),
      address: str(fd.get("address")),
      currency: str(fd.get("currency")),
      timezone: str(fd.get("timezone")),
    }),
  );
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function savePreferencesAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const actor = await requireActor();
  const days = Number(str(fd.get("invoices.defaultDueDays")));
  const r = await toActionResult(() =>
    updatePreferences(actor, { "tasks.defaultPriority": str(fd.get("tasks.defaultPriority")), "invoices.defaultDueDays": days }),
  );
  if (!r.ok) return { error: r.error.message };
  revalidatePath("/settings/preferences");
  return { saved: true };
}

export async function savePermissionsAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const roleId = z.string().uuid().parse(fd.get("roleId"));
  const known = new Set<string>(ALL_PERMISSION_KEYS);
  const keys = fd.getAll("permissions").map(String).filter((k) => known.has(k)) as PermissionKey[];
  await toActionResult(() => setRolePermissions(actor, roleId, keys));
  revalidatePath("/settings/roles");
}

export async function createRoleAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  await toActionResult(() => createRole(actor, { name: str(fd.get("name")), description: str(fd.get("description")) || undefined }));
  revalidatePath("/settings/roles");
}
