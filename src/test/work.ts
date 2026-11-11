import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { loadActor } from "@/lib/auth/load-actor";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { createClient, createCompany, createEmployee, createProject, createUser, grantPermissions } from "./factories";

export const MANAGER_KEYS: PermissionKey[] = [
  "tasks.read.all",
  "tasks.create",
  "tasks.update",
  "tasks.assign",
  "tasks.archive",
  "tasks.bulk",
  "tasks.comment",
  "tasks.attach",
  "projects.read.all",
  "clients.read",
];

export const EMPLOYEE_KEYS: PermissionKey[] = ["tasks.status.update.own", "tasks.comment", "tasks.attach"];

/** A company with a manager actor, plus helpers to create employee actors, projects and clients. */
export async function workWorld(managerKeys: PermissionKey[] = MANAGER_KEYS) {
  const company = await createCompany();
  const mUser = await createUser(company.id);
  const mEmp = await createEmployee(company.id, { userId: mUser.id });
  await grantPermissions(company.id, mUser.id, managerKeys, "Manager");
  const manager = await loadActor(mUser.id);

  async function employee(keys: PermissionKey[] = EMPLOYEE_KEYS): Promise<{ actor: Actor; employeeId: string; userId: string }> {
    const u = await createUser(company.id);
    const e = await createEmployee(company.id, { userId: u.id });
    await grantPermissions(company.id, u.id, keys, `Emp ${u.id.slice(0, 6)}`);
    return { actor: await loadActor(u.id), employeeId: e.id, userId: u.id };
  }

  async function project(opts: { clientId?: string | null; members?: string[] } = {}) {
    const owner = await createEmployee(company.id);
    const p = await createProject(company.id, owner.id, {
      type: opts.clientId ? "Client" : "Internal",
      clientId: opts.clientId ?? null,
    });
    for (const employeeId of [owner.id, ...(opts.members ?? [])]) {
      await db.insert(projectMembers).values({ projectId: p.id, companyId: company.id, employeeId, membershipRole: employeeId === owner.id ? "owner" : "member" });
    }
    return p;
  }

  const client = () => createClient(company.id);
  const bareEmployee = (o: Parameters<typeof createEmployee>[1] = {}) => createEmployee(company.id, o);

  return { company, manager, managerEmployeeId: mEmp.id, managerUserId: mUser.id, employee, project, client, bareEmployee };
}
