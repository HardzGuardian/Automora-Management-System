import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { account, session, user } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { loadActor } from "@/lib/auth/load-actor";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { addClientNote, archiveClient, getClient, listClientNotes, unarchiveClient, updateClient, listClients, createClient } from "@/modules/clients";
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  getEmployeeTasks,
  getWorkload,
  listEmployees,
  reactivateEmployee,
  suspendEmployee,
  updateEmployee,
} from "@/modules/employees";
import { readFile } from "@/modules/files";
import {
  addMember,
  changeOwner,
  changeProjectStatus,
  createMilestone,
  createProject,
  deleteMilestone,
  getProject,
  getProjectProgress,
  listMembers,
  listMilestones,
  listProjects,
  removeMember,
  setMemberRole,
  updateMilestone,
  updateProject,
} from "@/modules/projects";
import {
  addComment,
  archiveTask,
  assignTask,
  attachToTask,
  bulkArchive,
  bulkChangeStatus,
  bulkReassign,
  canAccessTaskAttachment,
  changeTaskStatus,
  createTask,
  deleteComment,
  editComment,
  getTask,
  listAttachments,
  listComments,
  listTaskActivity,
  listTasks,
  reassignTask,
  removeAttachment,
  unassignTask,
  updateTask,
} from "@/modules/tasks";
import {
  assignRole,
  createInvitation,
  createRole,
  removeRole,
  resendInvitation,
  revokeInvitation,
  revokeSession,
  setRolePermissions,
} from "@/modules/auth";
import { createCompany, createEmployee as makeEmployee, createUser, grantPermissions } from "@/test/factories";
import { EMPLOYEE_KEYS } from "@/test/work";

const PDF = { name: "a.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.7\nx") };
let n = 0;
const email = () => `sec${Date.now()}${n++}@test.local`;

/** One company with a fully privileged admin and one record of every kind. */
async function tenant() {
  const company = await createCompany();
  const u = await createUser(company.id);
  const emp = await makeEmployee(company.id, { userId: u.id });
  const role = await grantPermissions(company.id, u.id, [...ALL_PERMISSION_KEYS], `Admin ${randomUUID().slice(0, 6)}`);
  const admin = await loadActor(u.id);

  const staffUser = await createUser(company.id);
  const staff = await makeEmployee(company.id, { userId: staffUser.id });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: staffUser.id,
    providerId: "credential",
    userId: staffUser.id,
    password: await (await auth.$context).password.hash("sec-password-123"),
  });
  const staffRole = await grantPermissions(company.id, staffUser.id, EMPLOYEE_KEYS, `Staff ${randomUUID().slice(0, 6)}`);
  const staffActor = await loadActor(staffUser.id);

  const client = await createClient(admin, { name: "Acme" });
  const project = await createProject(admin, { name: "P", type: "Client", clientId: client.id, ownerEmployeeId: emp.id });
  const milestone = await createMilestone(admin, project.id, { name: "M1" });
  const task = await createTask(admin, { title: "T", projectId: project.id, assigneeIds: [staff.id] });
  const comment = await addComment(staffActor, task.id, "hello");
  const attachment = await attachToTask(staffActor, task.id, PDF);
  const invitation = await createInvitation(admin, { email: email(), roleId: staffRole.id });

  const [sess] = await (async () => {
    await db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: staffUser.id,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    return db.select().from(session).where(eq(session.userId, staffUser.id));
  })();

  return { company, admin, adminRole: role, emp, staff, staffUser, staffActor, staffRole, client, project, milestone, task, comment, attachment, invitation, session: sess };
}

type T = Awaited<ReturnType<typeof tenant>>;

// ---------- cross-company: an attacker with EVERY permission in another company ----------
type Attack = [name: string, run: (attacker: T["admin"], victim: T, attackerOwn: T) => Promise<unknown>];

const crossCompany: Attack[] = [
  ["getEmployee", (a, v) => getEmployee(a, v.staff.id)],
  ["updateEmployee", (a, v) => updateEmployee(a, v.staff.id, { designation: "x" })],
  ["deactivateEmployee", (a, v) => deactivateEmployee(a, v.staff.id, {})],
  ["suspendEmployee", (a, v) => suspendEmployee(a, v.staff.id, {})],
  ["reactivateEmployee", (a, v) => reactivateEmployee(a, v.staff.id)],
  ["getWorkload", (a, v) => getWorkload(a, v.staff.id)],
  ["getEmployeeTasks", (a, v) => getEmployeeTasks(a, v.staff.id, "assigned")],
  ["getClient", (a, v) => getClient(a, v.client.id)],
  ["updateClient", (a, v) => updateClient(a, v.client.id, { phone: "1" })],
  ["archiveClient", (a, v) => archiveClient(a, v.client.id)],
  ["unarchiveClient", (a, v) => unarchiveClient(a, v.client.id)],
  ["addClientNote", (a, v) => addClientNote(a, v.client.id, "x")],
  ["listClientNotes", (a, v) => listClientNotes(a, v.client.id)],
  ["getProject", (a, v) => getProject(a, v.project.id)],
  ["updateProject", (a, v) => updateProject(a, v.project.id, { name: "x" })],
  ["changeProjectStatus", (a, v) => changeProjectStatus(a, v.project.id, "Active")],
  ["getProjectProgress", (a, v) => getProjectProgress(a, v.project.id)],
  ["listMembers", (a, v) => listMembers(a, v.project.id)],
  ["addMember", (a, v, own) => addMember(a, v.project.id, own.emp.id)],
  ["removeMember", (a, v) => removeMember(a, v.project.id, v.staff.id)],
  ["setMemberRole", (a, v) => setMemberRole(a, v.project.id, v.staff.id, "viewer")],
  ["changeOwner", (a, v, own) => changeOwner(a, v.project.id, own.emp.id)],
  ["listMilestones", (a, v) => listMilestones(a, v.project.id)],
  ["createMilestone", (a, v) => createMilestone(a, v.project.id, { name: "x" })],
  ["updateMilestone", (a, v) => updateMilestone(a, v.project.id, v.milestone.id, { name: "x" })],
  ["deleteMilestone", (a, v) => deleteMilestone(a, v.project.id, v.milestone.id)],
  ["createProject (victim's client)", (a, v, own) => createProject(a, { name: "x", type: "Client", clientId: v.client.id, ownerEmployeeId: own.emp.id })],
  ["createProject (victim's employee as owner)", (a, v) => createProject(a, { name: "x", type: "Internal", ownerEmployeeId: v.emp.id })],
  ["getTask", (a, v) => getTask(a, v.task.id)],
  ["updateTask", (a, v) => updateTask(a, v.task.id, { title: "x" })],
  ["archiveTask", (a, v) => archiveTask(a, v.task.id)],
  ["changeTaskStatus", (a, v) => changeTaskStatus(a, v.task.id, "In Progress")],
  ["assignTask", (a, v, own) => assignTask(a, v.task.id, [own.emp.id])],
  ["unassignTask", (a, v) => unassignTask(a, v.task.id, v.staff.id)],
  ["reassignTask", (a, v, own) => reassignTask(a, v.task.id, v.staff.id, own.emp.id)],
  ["listTaskActivity", (a, v) => listTaskActivity(a, v.task.id)],
  ["createTask (victim's project)", (a, v) => createTask(a, { title: "x", projectId: v.project.id })],
  ["createTask (victim's client)", (a, v) => createTask(a, { title: "x", clientId: v.client.id })],
  ["createTask (victim's assignee)", (a, v) => createTask(a, { title: "x", assigneeIds: [v.staff.id] })],
  ["addComment", (a, v) => addComment(a, v.task.id, "x")],
  ["listComments", (a, v) => listComments(a, v.task.id)],
  ["editComment", (a, v) => editComment(a, v.comment.id, "x")],
  ["deleteComment", (a, v) => deleteComment(a, v.comment.id)],
  ["attachToTask", (a, v) => attachToTask(a, v.task.id, PDF)],
  ["listAttachments", (a, v) => listAttachments(a, v.task.id)],
  ["removeAttachment", (a, v) => removeAttachment(a, v.task.id, v.attachment.id)],
  ["readFile (download)", (a, v) => readFile(a, v.attachment.fileId, [canAccessTaskAttachment])],
  ["resendInvitation", (a, v) => resendInvitation(a, v.invitation.invitationId)],
  ["revokeInvitation", (a, v) => revokeInvitation(a, v.invitation.invitationId)],
  ["createInvitation (victim's role)", (a, v) => createInvitation(a, { email: email(), roleId: v.staffRole.id })],
  ["createInvitation (victim's employee)", (a, v, own) => createInvitation(a, { email: email(), roleId: own.staffRole.id, employeeId: v.emp.id })],
  ["setRolePermissions", (a, v) => setRolePermissions(a, v.staffRole.id, ["tasks.create"])],
  ["assignRole (victim's role)", (a, v, own) => assignRole(a, own.staffUser.id, v.staffRole.id)],
  ["assignRole (victim's user)", (a, v, own) => assignRole(a, v.staffUser.id, own.staffRole.id)],
  ["removeRole", (a, v, own) => removeRole(a, v.staffUser.id, own.staffRole.id)],
  ["revokeSession", (a, v) => revokeSession(a, v.session.id)],
];

describe("cross-company isolation: a fully privileged user of another company", () => {
  it.each(crossCompany)("%s is NOT_FOUND", async (_name, run) => {
    const victim = await tenant();
    const attacker = await tenant();
    await expect(run(attacker.admin, victim, attacker)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list endpoints never contain the other company's records", async () => {
    const victim = await tenant();
    const attacker = await tenant();
    const a = attacker.admin;
    const ids = {
      employees: (await listEmployees(a, { pageSize: 100 })).rows.map((r) => r.id),
      clients: (await listClients(a, { pageSize: 100, includeArchived: true })).rows.map((r) => r.id),
      projects: (await listProjects(a, { pageSize: 100, includeArchived: true })).rows.map((r) => r.id),
      tasksAll: (await listTasks(a, { view: "all", pageSize: 100, includeArchived: true })).rows.map((r) => r.id),
    };
    expect(ids.employees).not.toContain(victim.staff.id);
    expect(ids.clients).not.toContain(victim.client.id);
    expect(ids.projects).not.toContain(victim.project.id);
    expect(ids.tasksAll).not.toContain(victim.task.id);
  });

  it("bulk operations report NOT_FOUND per record and change nothing", async () => {
    const victim = await tenant();
    const attacker = await tenant();
    const a = attacker.admin;
    for (const r of [
      await bulkChangeStatus(a, [victim.task.id], "In Progress"),
      await bulkArchive(a, [victim.task.id]),
      await bulkReassign(a, [victim.task.id], victim.staff.id, attacker.emp.id),
    ]) {
      expect(r.succeeded).toBe(0);
      expect(r.results[0]).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    }
    expect((await getTask(victim.admin, victim.task.id)).status).toBe("Pending");
  });
});

// ---------- privilege escalation: a low-privilege employee of the SAME company ----------
const escalation: Attack[] = [
  ["createEmployee", (a) => createEmployee(a, { fullName: "x", workEmail: email() })],
  ["updateEmployee", (a, v) => updateEmployee(a, v.emp.id, { designation: "x" })],
  ["deactivateEmployee", (a, v) => deactivateEmployee(a, v.emp.id, {})],
  ["suspendEmployee", (a, v) => suspendEmployee(a, v.emp.id, {})],
  ["reactivateEmployee", (a, v) => reactivateEmployee(a, v.emp.id)],
  ["listEmployees", (a) => listEmployees(a, {})],
  ["getEmployee (someone else)", (a, v) => getEmployee(a, v.emp.id)],
  ["getWorkload (someone else)", (a, v) => getWorkload(a, v.emp.id)],
  ["getEmployeeTasks (someone else)", (a, v) => getEmployeeTasks(a, v.emp.id, "assigned")],
  ["createClient", (a) => createClient(a, { name: "x" })],
  ["listClients", (a) => listClients(a, {})],
  ["getClient", (a, v) => getClient(a, v.client.id)],
  ["updateClient", (a, v) => updateClient(a, v.client.id, { phone: "1" })],
  ["archiveClient", (a, v) => archiveClient(a, v.client.id)],
  ["addClientNote", (a, v) => addClientNote(a, v.client.id, "x")],
  ["createProject", (a, v) => createProject(a, { name: "x", type: "Internal", ownerEmployeeId: v.emp.id })],
  ["updateProject", (a, v) => updateProject(a, v.project.id, { name: "x" })],
  ["changeProjectStatus", (a, v) => changeProjectStatus(a, v.project.id, "Active")],
  ["addMember", (a, v) => addMember(a, v.project.id, v.staff.id)],
  ["removeMember", (a, v) => removeMember(a, v.project.id, v.emp.id)],
  ["changeOwner", (a, v) => changeOwner(a, v.project.id, v.staff.id)],
  ["createMilestone", (a, v) => createMilestone(a, v.project.id, { name: "x" })],
  ["createTask", (a) => createTask(a, { title: "x" })],
  ["updateTask (their own assigned task)", (a, v) => updateTask(a, v.task.id, { title: "x" })],
  ["archiveTask", (a, v) => archiveTask(a, v.task.id)],
  ["assignTask", (a, v) => assignTask(a, v.task.id, [v.staff.id])],
  ["unassignTask", (a, v) => unassignTask(a, v.task.id, v.staff.id)],
  ["reassignTask", (a, v) => reassignTask(a, v.task.id, v.staff.id, v.emp.id)],
  ["complete own task (review decision)", async (a, v) => {
    await changeTaskStatus(a, v.task.id, "In Progress");
    await changeTaskStatus(a, v.task.id, "In Review");
    return changeTaskStatus(a, v.task.id, "Completed");
  }],
  ["bulkChangeStatus", (a, v) => bulkChangeStatus(a, [v.task.id], "In Progress")],
  ["bulkArchive", (a, v) => bulkArchive(a, [v.task.id])],
  ["createInvitation", (a, v) => createInvitation(a, { email: email(), roleId: v.staffRole.id })],
  ["resendInvitation", (a, v) => resendInvitation(a, v.invitation.invitationId)],
  ["revokeInvitation", (a, v) => revokeInvitation(a, v.invitation.invitationId)],
  ["createRole", (a) => createRole(a, { name: "Backdoor" })],
  ["setRolePermissions (grant self everything)", (a, v) => setRolePermissions(a, v.staffRole.id, [...ALL_PERMISSION_KEYS])],
  ["assignRole (admin role to self)", (a, v) => assignRole(a, v.staffUser.id, v.adminRole.id)],
  ["removeRole (strip the admin)", (a, v) => removeRole(a, v.admin.userId, v.adminRole.id)],
];

describe("privilege escalation: a low-privilege employee in the same company", () => {
  it.each(escalation)("%s is refused", async (_name, run) => {
    const t = await tenant();
    // `a` = the staff actor; `v` = the same tenant (admin-owned records)
    await expect(run(t.staffActor, t, t)).rejects.toMatchObject({ code: expect.stringMatching(/^(FORBIDDEN|NOT_FOUND)$/) });
  });

  it("an employee cannot read a colleague's private task, comments or files", async () => {
    const t = await tenant();
    const colleague = await createUser(t.company.id);
    await makeEmployee(t.company.id, { userId: colleague.id });
    await grantPermissions(t.company.id, colleague.id, EMPLOYEE_KEYS, "Colleague");
    const c = await loadActor(colleague.id);
    await expect(getTask(c, t.task.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listComments(c, t.task.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listAttachments(c, t.task.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFile(c, t.attachment.fileId, [canAccessTaskAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listTasks(c, { view: "all", pageSize: 100 })).rows).toEqual([]);
    expect((await listProjects(c, {})).rows).toEqual([]);
  });

  it("the invitation role cannot be used to mint a Super Admin by someone without roles.manage/users.invite", async () => {
    const t = await tenant();
    await expect(createInvitation(t.staffActor, { email: email(), roleId: t.adminRole.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------- sessions and account state ----------
describe("session and account state", () => {
  it("a suspended user with a still-valid session row is rejected when building the actor", async () => {
    const t = await tenant();
    await db.update(user).set({ banned: true }).where(eq(user.id, t.staffUser.id)); // session NOT deleted on purpose
    expect((await db.select().from(session).where(eq(session.userId, t.staffUser.id))).length).toBeGreaterThan(0);
    await expect(loadActor(t.staffUser.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a user deleted from the database cannot build an actor", async () => {
    await expect(loadActor(randomUUID())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("deactivating an employee kills sessions and blocks sign-in", async () => {
    const t = await tenant();
    await deactivateEmployee(t.admin, t.staff.id, {});
    expect(await db.select().from(session).where(eq(session.userId, t.staffUser.id))).toHaveLength(0);
    await expect(loadActor(t.staffUser.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a role with zero permissions grants nothing", async () => {
    const t = await tenant();
    const u = await createUser(t.company.id);
    await grantPermissions(t.company.id, u.id, [], "Nothing");
    const a = await loadActor(u.id);
    await expect(createTask(a, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listEmployees(a, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------- uploads ----------
describe("upload validation through the attachment API", () => {
  it.each([
    ["executable", { name: "run.exe", mime: "application/octet-stream", bytes: Buffer.from("MZ\x90") }],
    ["html disguised as pdf", { name: "x.pdf", mime: "application/pdf", bytes: Buffer.from("<html><script>1</script>") }],
    ["script with a pdf mime", { name: "x.js", mime: "application/pdf", bytes: Buffer.from("%PDF-1.7") }],
    ["svg (script vector)", { name: "x.svg", mime: "image/svg+xml", bytes: Buffer.from("<svg onload=alert(1)>") }],
    ["double extension", { name: "invoice.pdf.exe", mime: "application/pdf", bytes: Buffer.from("%PDF-1.7") }],
    ["empty", { name: "a.txt", mime: "text/plain", bytes: Buffer.alloc(0) }],
    ["oversized", { name: "big.txt", mime: "text/plain", bytes: Buffer.alloc(10 * 1024 * 1024 + 1, 97) }],
  ])("rejects %s", async (_label, file) => {
    const t = await tenant();
    await expect(attachToTask(t.staffActor, t.task.id, file)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("stores a traversal-style filename safely under a server-generated key", async () => {
    const t = await tenant();
    const att = await attachToTask(t.staffActor, t.task.id, { ...PDF, name: "../../../etc/passwd.pdf" });
    expect(att.name).toBe("passwd.pdf");
    const got = await readFile(t.staffActor, att.fileId, [canAccessTaskAttachment]);
    expect(got.name).toBe("passwd.pdf");
    expect(got.bytes.equals(PDF.bytes)).toBe(true);
  });
});

