import "server-only";
import type { Actor } from "@/lib/auth/actor";
import { listProjects } from "@/modules/projects";

export type ProjectOption = { id: string; label: string };

/**
 * Projects the actor may see, as select options. `currentId` is always kept in the list so saving a form
 * never silently drops a project the actor cannot list. Returns [] when the list cannot be loaded.
 */
export async function loadProjectOptions(actor: Actor, currentId?: string | null): Promise<ProjectOption[]> {
  let options: ProjectOption[] = [];
  try {
    const { rows } = await listProjects(actor, { page: 1, pageSize: 100 });
    options = rows.map((p) => ({ id: p.id, label: `${p.projectCode} · ${p.name}` }));
  } catch {
    options = [];
  }
  if (currentId && !options.some((o) => o.id === currentId)) options = [{ id: currentId, label: "Current project" }, ...options];
  return options;
}
