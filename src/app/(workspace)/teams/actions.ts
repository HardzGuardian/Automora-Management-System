"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import {
  addTeamMember,
  archiveDepartment,
  archiveTeam,
  createDepartment,
  createTeam,
  removeTeamMember,
  setTeamMemberRole,
  updateTeam,
} from "@/modules/teams";

const uuid = z.string().uuid();
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: FormDataEntryValue | null) => (str(v).trim() === "" ? null : str(v).trim());
const role = z.enum(["lead", "member"]).catch("member");

function back(path: string, message?: string): never {
  redirect(message ? `${path}?error=${encodeURIComponent(message)}` : path);
}

export async function createDepartmentAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const r = await toActionResult(() => createDepartment(actor, { name: str(fd.get("name")), description: nullable(fd.get("description")) }));
  revalidatePath("/teams");
  back("/teams", r.ok ? undefined : (r.error.fieldErrors?.name?.[0] ?? r.error.message));
}

export async function archiveDepartmentAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const r = await toActionResult(() => archiveDepartment(actor, uuid.parse(fd.get("id"))));
  revalidatePath("/teams");
  back("/teams", r.ok ? undefined : r.error.message);
}

export async function createTeamAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const r = await toActionResult(() =>
    createTeam(actor, { departmentId: str(fd.get("departmentId")), name: str(fd.get("name")), description: nullable(fd.get("description")) }),
  );
  revalidatePath("/teams");
  if (!r.ok) back("/teams", r.error.fieldErrors?.name?.[0] ?? r.error.message);
  redirect(`/teams/${r.data.id}`);
}

export async function updateTeamAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => updateTeam(actor, id, { name: str(fd.get("name")), description: nullable(fd.get("description")) }));
  revalidatePath(`/teams/${id}`);
  revalidatePath("/teams");
  back(`/teams/${id}`, r.ok ? undefined : (r.error.fieldErrors?.name?.[0] ?? r.error.message));
}

export async function archiveTeamAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => archiveTeam(actor, id));
  revalidatePath("/teams");
  revalidatePath("/my-tasks");
  if (!r.ok) back(`/teams/${id}`, r.error.message);
  redirect("/teams");
}

export async function addMemberAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => addTeamMember(actor, id, uuid.parse(fd.get("employeeId")), role.parse(str(fd.get("role")))));
  revalidatePath(`/teams/${id}`);
  revalidatePath("/my-tasks");
  back(`/teams/${id}`, r.ok ? undefined : r.error.message);
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => removeTeamMember(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/teams/${id}`);
  revalidatePath("/my-tasks");
  back(`/teams/${id}`, r.ok ? undefined : r.error.message);
}

export async function setRoleAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => setTeamMemberRole(actor, id, uuid.parse(fd.get("employeeId")), role.parse(str(fd.get("role")))));
  revalidatePath(`/teams/${id}`);
  back(`/teams/${id}`, r.ok ? undefined : r.error.message);
}
