import { describe, expect, it } from "vitest";
import {
  createClient,
  createCompany,
  createEmployee,
  createProject,
  createTask,
} from "@/test/factories";

async function rejects(p: Promise<unknown>) {
  await expect(p).rejects.toThrow();
}

describe("schema constraints", () => {
  it("rejects a task whose project belongs to another company (composite FK)", async () => {
    const a = await createCompany();
    const b = await createCompany();
    const empB = await createEmployee(b.id);
    const projectB = await createProject(b.id, empB.id);
    await rejects(createTask(a.id, { projectId: projectB.id }));
  });

  it("rejects duplicate task_code in the same company, allows it across companies", async () => {
    const a = await createCompany();
    const b = await createCompany();
    await createTask(a.id, { taskCode: "TSK-000001" });
    await rejects(createTask(a.id, { taskCode: "TSK-000001" }));
    await createTask(b.id, { taskCode: "TSK-000001" });
  });

  it("enforces per-company uniqueness of employee, client and project codes", async () => {
    const a = await createCompany();
    const emp = await createEmployee(a.id, { employeeCode: "EMP-1" });
    await rejects(createEmployee(a.id, { employeeCode: "EMP-1" }));
    await createClient(a.id, { clientCode: "CLI-1" });
    await rejects(createClient(a.id, { clientCode: "CLI-1" }));
    await createProject(a.id, emp.id, { projectCode: "PRJ-1" });
    await rejects(createProject(a.id, emp.id, { projectCode: "PRJ-1" }));
  });

  it("requires a client for Client projects but not Internal ones", async () => {
    const a = await createCompany();
    const emp = await createEmployee(a.id);
    await rejects(createProject(a.id, emp.id, { type: "Client", clientId: null }));
    await createProject(a.id, emp.id, { type: "Internal", clientId: null });
    const client = await createClient(a.id);
    await createProject(a.id, emp.id, { type: "Client", clientId: client.id });
  });

  it("rejects start_date after due_date on tasks and projects", async () => {
    const a = await createCompany();
    const emp = await createEmployee(a.id);
    await rejects(createTask(a.id, { startDate: "2026-02-01", dueDate: "2026-01-01" }));
    await rejects(createProject(a.id, emp.id, { startDate: "2026-02-01", dueDate: "2026-01-01" }));
    await createTask(a.id, { startDate: "2026-01-01", dueDate: "2026-01-01" });
  });

  it("rejects invalid status and priority values", async () => {
    const a = await createCompany();
    await rejects(createTask(a.id, { status: "Blocked" }));
    await rejects(createTask(a.id, { priority: "Critical" }));
  });

  it("rejects a project owned by an employee of another company", async () => {
    const a = await createCompany();
    const b = await createCompany();
    const empB = await createEmployee(b.id);
    await rejects(createProject(a.id, empB.id));
  });
});
