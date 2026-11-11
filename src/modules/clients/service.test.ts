import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, projects, tasks } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { buildActor, createCompany, createEmployee, createProject, createTask, createUser, grantPermissions } from "@/test/factories";
import {
  addClientNote,
  archiveClient,
  createClient,
  getClient,
  listClientNotes,
  listClients,
  unarchiveClient,
  updateClient,
} from "./service";

const ALL = ["clients.read", "clients.create", "clients.update", "clients.archive"] as const;

async function world(keys: readonly (typeof ALL)[number][] = ALL) {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, [...keys], "Sales");
  return { company, u, actor: await loadActor(u.id) };
}
const mk = (o: Record<string, unknown> = {}) => ({ name: "Northwind Traders", ...o });

describe("permissions", () => {
  it("denies every operation without the matching permission", async () => {
    const c = await createCompany();
    const nobody = buildActor({ companyId: c.id });
    const id = "00000000-0000-0000-0000-000000000000";
    await expect(createClient(nobody, mk())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateClient(nobody, id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClient(nobody, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listClients(nobody, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archiveClient(nobody, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addClientNote(nobody, id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listClientNotes(nobody, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("create / update / get", () => {
  it("creates with a CLI code and audits", async () => {
    const w = await world();
    const c = await createClient(w.actor, mk({ email: "Buyer@Northwind.com", contactPerson: "Jo", serviceType: "Web" }));
    expect(c).toMatchObject({ clientCode: "CLI-000001", status: "Active", email: "buyer@northwind.com", archived: false });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, c.id));
    expect(logs.map((l) => l.action)).toEqual(["client.created"]);
  });

  it("validates input", async () => {
    const w = await world();
    await expect(createClient(w.actor, mk({ name: "" }))).rejects.toThrow();
    await expect(createClient(w.actor, mk({ email: "nope" }))).rejects.toThrow();
  });

  it("updates fields and status; other company's client is NOT_FOUND", async () => {
    const w = await world();
    const other = await world();
    const c = await createClient(w.actor, mk());
    const u = await updateClient(w.actor, c.id, { phone: "+91 90000 00000", status: "Inactive" });
    expect(u).toMatchObject({ phone: "+91 90000 00000", status: "Inactive", name: "Northwind Traders" });
    await expect(updateClient(other.actor, c.id, { phone: "1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getClient(other.actor, c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("list", () => {
  it("searches, paginates, hides archived by default and never leaks other companies", async () => {
    const w = await world();
    const other = await world();
    await createClient(other.actor, mk({ name: "Foreign Co" }));
    for (const n of ["Acme A", "Acme B", "Beta C"]) await createClient(w.actor, mk({ name: n }));
    const gone = await createClient(w.actor, mk({ name: "Acme Gone" }));
    await archiveClient(w.actor, gone.id);

    expect((await listClients(w.actor, {})).total).toBe(3);
    expect((await listClients(w.actor, { includeArchived: true })).total).toBe(4);
    expect((await listClients(w.actor, { search: "acme" })).rows.map((r) => r.name)).toEqual(["Acme A", "Acme B"]);
    expect((await listClients(w.actor, { page: 2, pageSize: 2 })).rows.map((r) => r.name)).toEqual(["Beta C"]);
    expect((await listClients(w.actor, { search: "Foreign" })).total).toBe(0);
    await expect(listClients(w.actor, { pageSize: 101 })).rejects.toThrow();
  });
});

describe("archive (AC-13)", () => {
  it("keeps the client's projects and tasks and is reversible", async () => {
    const w = await world();
    const client = await createClient(w.actor, mk());
    const emp = await createEmployee(w.company.id);
    const project = await createProject(w.company.id, emp.id, { type: "Client", clientId: client.id });
    const task = await createTask(w.company.id, { projectId: project.id, clientId: client.id });

    const archived = await archiveClient(w.actor, client.id);
    expect(archived.archived).toBe(true);
    expect(await db.select().from(projects).where(eq(projects.id, project.id))).toHaveLength(1);
    expect(await db.select().from(tasks).where(eq(tasks.id, task.id))).toHaveLength(1);
    expect((await getClient(w.actor, client.id)).archived).toBe(true);

    await expect(archiveClient(w.actor, client.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await unarchiveClient(w.actor, client.id)).archived).toBe(false);
  });

  it("needs clients.archive", async () => {
    const w = await world(["clients.read", "clients.create"]);
    const c = await createClient(w.actor, mk());
    await expect(archiveClient(w.actor, c.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("notes", () => {
  it("adds notes newest first, trims, rejects empty, and respects company boundaries", async () => {
    const w = await world();
    const other = await world();
    const c = await createClient(w.actor, mk());
    await addClientNote(w.actor, c.id, "  first  ");
    await addClientNote(w.actor, c.id, "second");
    const notes = await listClientNotes(w.actor, c.id);
    expect(notes.map((n) => n.note)).toEqual(["second", "first"]);
    await expect(addClientNote(w.actor, c.id, "   ")).rejects.toThrow();
    await expect(addClientNote(other.actor, c.id, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listClientNotes(other.actor, c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
