import { and, eq, like } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  clients,
  employees,
  projectMembers,
  projects,
  taskAssignees,
  tasks,
} from "@/db/schema";
import { nextCode } from "@/lib/codes";

// Labelled demo data, created only with SEED_DEMO=true. Every record starts with "[DEMO]".
export async function seedDemoData(tx: Tx, companyId: string): Promise<void> {
  const [already] = await tx
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.companyId, companyId), like(clients.name, "[DEMO]%")))
    .limit(1);
  if (already) return;

  const people = [
    { fullName: "[DEMO] Asha Rao", designation: "Project Manager", department: "Delivery" },
    { fullName: "[DEMO] Ravi Patel", designation: "Developer", department: "Engineering" },
    { fullName: "[DEMO] Neha Shah", designation: "Designer", department: "Design" },
  ];
  const emps = [];
  for (const [i, p] of people.entries()) {
    const [e] = await tx
      .insert(employees)
      .values({
        companyId,
        employeeCode: await nextCode(tx, companyId, "EMP"),
        workEmail: `demo.employee${i + 1}@example.com`,
        ...p,
      })
      .returning();
    emps.push(e);
  }

  const cls = [];
  for (const name of ["[DEMO] Northwind Traders", "[DEMO] Globex Corp"]) {
    const [c] = await tx
      .insert(clients)
      .values({ companyId, clientCode: await nextCode(tx, companyId, "CLI"), name, serviceType: "Web development" })
      .returning();
    cls.push(c);
  }

  const [clientProject] = await tx
    .insert(projects)
    .values({
      companyId,
      projectCode: await nextCode(tx, companyId, "PRJ"),
      name: "[DEMO] Northwind Website",
      type: "Client",
      clientId: cls[0].id,
      ownerEmployeeId: emps[0].id,
      status: "Active",
    })
    .returning();
  const [internalProject] = await tx
    .insert(projects)
    .values({
      companyId,
      projectCode: await nextCode(tx, companyId, "PRJ"),
      name: "[DEMO] Internal Tooling",
      type: "Internal",
      ownerEmployeeId: emps[0].id,
      status: "Planning",
    })
    .returning();

  await tx.insert(projectMembers).values(
    emps.map((e, i) => ({
      projectId: clientProject.id,
      companyId,
      employeeId: e.id,
      membershipRole: i === 0 ? "owner" : "member",
    })),
  );

  const taskDefs = [
    { title: "[DEMO] Design homepage", project: clientProject, assignee: emps[2], status: "In Progress", priority: "High" },
    { title: "[DEMO] Build contact form", project: clientProject, assignee: emps[1], status: "Pending", priority: "Medium" },
    { title: "[DEMO] Review launch checklist", project: clientProject, assignee: emps[0], status: "In Review", priority: "Urgent" },
    { title: "[DEMO] Set up CI", project: internalProject, assignee: emps[1], status: "Completed", priority: "Low" },
    { title: "[DEMO] Draft onboarding doc", project: internalProject, assignee: emps[0], status: "Pending", priority: "Medium" },
  ];
  for (const t of taskDefs) {
    const [row] = await tx
      .insert(tasks)
      .values({
        companyId,
        taskCode: await nextCode(tx, companyId, "TSK"),
        title: t.title,
        projectId: t.project.id,
        clientId: t.project.clientId,
        status: t.status,
        priority: t.priority,
        completedAt: t.status === "Completed" ? new Date() : null,
      })
      .returning();
    await tx.insert(taskAssignees).values({ taskId: row.id, companyId, employeeId: t.assignee.id });
  }
}
