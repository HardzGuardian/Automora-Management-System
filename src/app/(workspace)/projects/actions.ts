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
import { addProjectDocument, removeProjectDocument } from "@/modules/documents";
import { listTeamCards } from "@/modules/teams";

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

export type SetupInput = { name: string; clientId: string; dueDate: string; description: string; teamId: string };
export type SetupResult =
  | { ok: true; id: string; teamLabel: string; people: string[]; teamError?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Step one of the New project page: the details and the team. Documents follow one by one through
 * uploadProjectDocumentAction, because a Server Action request is limited to one upload's size.
 */
export async function createProjectSetupAction(input: SetupInput): Promise<SetupResult> {
  const actor = await requireActor();
  if (!input.name.trim()) return { ok: false, error: "Enter a project name.", fieldErrors: { name: ["Enter a project name."] } };
  if (!input.teamId) return { ok: false, error: "Choose the team this project is assigned to." };
  if (!actor.employeeId) return { ok: false, error: "Your account has no employee record, so it cannot own a project." };

  const cards = await listTeamCards(actor, "projects.members.manage");
  const team = cards.find((t) => t.id === input.teamId);
  if (!team) return { ok: false, error: "That team is not available. Choose another." };

  const clientId = input.clientId.trim() || null;
  const r = await toActionResult(() =>
    createProject(actor, {
      name: input.name,
      description: input.description.trim() || null,
      type: clientId ? "Client" : "Internal",
      clientId,
      ownerEmployeeId: actor.employeeId!,
      startDate: null,
      dueDate: input.dueDate.trim() || null,
      budgetAmount: null,
    }),
  );
  if (!r.ok) return { ok: false, error: r.error.message, fieldErrors: r.error.fieldErrors };

  const assigned = await toActionResult(() => assignProjectToTeam(actor, r.data.id, team.id));
  revalidatePath("/projects");
  revalidatePath("/teams");
  return {
    ok: true,
    id: r.data.id,
    teamLabel: `${team.department}, ${team.name}`,
    people: team.people,
    teamError: assigned.ok ? undefined : assigned.error.message,
  };
}

export type UploadResult = { ok: true } | { ok: false; error: string };

export async function uploadProjectDocumentAction(fd: FormData): Promise<UploadResult> {
  const actor = await requireActor();
  const projectId = uuid.parse(fd.get("projectId"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const r = await toActionResult(() => addProjectDocument(actor, projectId, { name: file.name, mime: file.type, bytes }));
  if (!r.ok) return { ok: false, error: r.error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/documents");
  return { ok: true };
}

export async function removeProjectDocumentAction(fd: FormData): Promise<void> {
  const actor = await requireActor();
  const projectId = uuid.parse(fd.get("projectId"));
  await toActionResult(() => removeProjectDocument(actor, projectId, uuid.parse(fd.get("documentId"))));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/documents");
}
