import { describe, expect, it } from "vitest";
import { createClient } from "@/modules/clients";
import { createEmployee } from "@/modules/employees";
import { createProject } from "@/modules/projects";
import { createTask } from "@/modules/tasks";
import { workWorld } from "@/test/work";
import { addProjectDocument } from "@/modules/documents";
import { globalSearch } from "./service";

async function seeded() {
  const w = await workWorld(["tasks.read.all", "tasks.create", "tasks.assign", "projects.read.all", "projects.create", "projects.update", "clients.read", "clients.create", "employees.read", "employees.create"]);
  const staff = await w.employee();
  const client = await createClient(w.manager, { name: "Zephyr Industries" });
  await createEmployee(w.manager, { fullName: "Zephyra Menon", workEmail: "zephyra@test.local" });
  const project = await createProject(w.manager, { name: "Zephyr Portal", type: "Client", clientId: client.id, ownerEmployeeId: w.managerEmployeeId });
  const visible = await createTask(w.manager, { title: "Zephyr kickoff", assigneeIds: [staff.employeeId] });
  const hidden = await createTask(w.manager, { title: "Zephyr secret budget" });
  return { w, staff, client, project, visible, hidden };
}

describe("globalSearch", () => {
  it("finds employees, clients, projects and tasks for a fully privileged user", async () => {
    const s = await seeded();
    const r = await globalSearch(s.w.manager, "zephyr");
    expect(r.employees.map((x) => x.title)).toContain("Zephyra Menon");
    expect(r.clients.map((x) => x.title)).toEqual(["Zephyr Industries"]);
    expect(r.projects.map((x) => x.title)).toEqual(["Zephyr Portal"]);
    expect(r.tasks.map((x) => x.title).sort()).toEqual(["Zephyr kickoff", "Zephyr secret budget"]);
    expect(r.total).toBe(r.employees.length + r.clients.length + r.projects.length + r.tasks.length + r.documents.length);
  });

  it("finds documents by file name, linking to the project's documents, and hides them from people outside the project", async () => {
    const s = await seeded();
    await addProjectDocument(s.w.manager, s.project.id, { name: "zephyr-brief.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.7 x") });
    const r = await globalSearch(s.w.manager, "zephyr-brief");
    expect(r.documents).toHaveLength(1);
    expect(r.documents[0]).toMatchObject({ type: "document", title: "zephyr-brief.pdf", href: `/projects/${s.project.id}?tab=documents` });
    expect((await globalSearch(s.staff.actor, "zephyr-brief")).documents).toHaveLength(0);
  });

  it("returns links to the records", async () => {
    const s = await seeded();
    const r = await globalSearch(s.w.manager, "kickoff");
    expect(r.tasks[0]).toMatchObject({ id: s.visible.id, href: `/tasks/${s.visible.id}`, type: "task" });
    expect((await globalSearch(s.w.manager, "Portal")).projects[0].href).toBe(`/projects/${s.project.id}`);
    expect((await globalSearch(s.w.manager, "Industries")).clients[0].href).toBe(`/clients/${s.client.id}`);
  });

  it("shows an employee only the tasks they may see, and no employees, clients or other projects", async () => {
    const s = await seeded();
    const r = await globalSearch(s.staff.actor, "zephyr");
    expect(r.tasks.map((x) => x.id)).toEqual([s.visible.id]);
    expect(r.tasks.map((x) => x.id)).not.toContain(s.hidden.id);
    expect(r.employees).toEqual([]);
    expect(r.clients).toEqual([]);
    expect(r.projects).toEqual([]);
  });

  it("never returns another company's records", async () => {
    await seeded();
    const other = await workWorld();
    const r = await globalSearch(other.manager, "zephyr");
    expect(r.total).toBe(0);
  });

  it("excludes archived records", async () => {
    const { archiveTask } = await import("@/modules/tasks");
    const m = await workWorld(["tasks.read.all", "tasks.create", "tasks.archive"]);
    const t = await createTask(m.manager, { title: "Quokka plan" });
    expect((await globalSearch(m.manager, "quokka")).tasks).toHaveLength(1);
    await archiveTask(m.manager, t.id);
    expect((await globalSearch(m.manager, "quokka")).tasks).toHaveLength(0);
  });

  it("requires at least 2 characters, caps results per type, and treats wildcards literally", async () => {
    const s = await seeded();
    expect((await globalSearch(s.w.manager, "z")).total).toBe(0);
    expect((await globalSearch(s.w.manager, "  ")).total).toBe(0);
    expect((await globalSearch(s.w.manager, "%%")).total).toBe(0);
    expect((await globalSearch(s.w.manager, "_")).total).toBe(0);
    for (let i = 0; i < 8; i++) await createTask(s.w.manager, { title: `Many match ${i}` });
    expect((await globalSearch(s.w.manager, "many match")).tasks.length).toBeLessThanOrEqual(5);
  });
});
