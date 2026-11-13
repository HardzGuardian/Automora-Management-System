"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth/require-actor";
import { toActionResult } from "@/lib/errors";
import {
  addMember,
  assignProjectToTeam,
  unassignProjectFromTeam,
  changeProjectStatus,
  createMilestone,
  createProject,
  removeMember,
  updateMilestone,
} from "@/modules/projects";

export type ProjectFormState = { error?: string; fieldErrors?: Record<string, string[]> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const nullable = (v: FormDataEntryValue | null) => (str(v).trim() === "" ? null : str(v).trim());
const uuid = z.string().uuid();

export async function createProjectAction(_prev: ProjectFormState, fd: FormData): Promise<ProjectFormState> {
  const actor = await requireActor();
  const type = str(fd.get("type")) === "Internal" ? "Internal" : "Client";
  const r = await toActionResult(() =>
    createProject(actor, {
      name: str(fd.get("name")),
      description: nullable(fd.get("description")),
      type,
      clientId: type === "Client" ? nullable(fd.get("clientId")) : null,
      ownerEmployeeId: str(fd.get("ownerEmployeeId")),
      startDate: nullable(fd.get("startDate")),
      dueDate: nullable(fd.get("dueDate")),
      budgetAmount: nullable(fd.get("budgetAmount")),
    }),
  );
  if (!r.ok) return { error: r.error.message, fieldErrors: r.error.fieldErrors };
  revalidatePath("/projects");
  redirect(`/projects/${r.data.id}`);
}

export async function changeStatusAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const to = z.enum(["Planning", "Active", "On Hold", "Completed", "Cancelled", "Archived"]).parse(fd.get("to"));
  await toActionResult(() => changeProjectStatus(actor, id, to));
  revalidatePath(`/projects/${id}`);
}

export async function addMemberAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => addMember(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/projects/${id}`);
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => removeMember(actor, id, uuid.parse(fd.get("employeeId"))));
  revalidatePath(`/projects/${id}`);
}

export async function addMilestoneAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  await toActionResult(() => createMilestone(actor, id, { name: str(fd.get("name")), dueDate: nullable(fd.get("dueDate")) }));
  revalidatePath(`/projects/${id}`);
}

export async function milestoneStatusAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["Pending", "In Progress", "Completed"]).parse(fd.get("status"));
  await toActionResult(() => updateMilestone(actor, id, uuid.parse(fd.get("milestoneId")), { status }));
  revalidatePath(`/projects/${id}`);
}

export async function assignProjectTeamAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => assignProjectToTeam(actor, id, uuid.parse(fd.get("teamId"))));
  revalidatePath(`/projects/${id}`);
  if (!r.ok) redirect(`/projects/${id}?error=${encodeURIComponent(r.error.message)}`);
}

export async function unassignProjectTeamAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const id = uuid.parse(fd.get("id"));
  const r = await toActionResult(() => unassignProjectFromTeam(actor, id, uuid.parse(fd.get("teamId"))));
  revalidatePath(`/projects/${id}`);
  if (!r.ok) redirect(`/projects/${id}?error=${encodeURIComponent(r.error.message)}`);
}
