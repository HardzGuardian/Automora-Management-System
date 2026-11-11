import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  clients,
  companies,
  employees,
  projects,
  tasks,
  user,
} from "@/db/schema";

type Overrides<T> = Partial<T>;

export async function createCompany(o: Overrides<typeof companies.$inferInsert> = {}) {
  const [row] = await db
    .insert(companies)
    .values({ legalName: "Test Co Pvt Ltd", displayName: "Test Co", ...o })
    .returning();
  return row;
}

export async function createUser(
  companyId: string,
  o: Overrides<typeof user.$inferInsert> = {},
) {
  const id = o.id ?? randomUUID();
  const [row] = await db
    .insert(user)
    .values({ id, companyId, name: "User " + id.slice(0, 6), email: `${id}@test.local`, ...o })
    .returning();
  return row;
}

export async function createEmployee(
  companyId: string,
  o: Overrides<typeof employees.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(employees)
    .values({
      companyId,
      employeeCode: `EMP-${n}`,
      fullName: `Employee ${n}`,
      workEmail: `${n}@test.local`,
      ...o,
    })
    .returning();
  return row;
}

export async function createClient(
  companyId: string,
  o: Overrides<typeof clients.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(clients)
    .values({ companyId, clientCode: `CLI-${n}`, name: `Client ${n}`, ...o })
    .returning();
  return row;
}

export async function createProject(
  companyId: string,
  ownerEmployeeId: string,
  o: Overrides<typeof projects.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(projects)
    .values({
      companyId,
      ownerEmployeeId,
      projectCode: `PRJ-${n}`,
      name: `Project ${n}`,
      type: "Internal",
      ...o,
    })
    .returning();
  return row;
}

export async function createTask(
  companyId: string,
  o: Overrides<typeof tasks.$inferInsert> = {},
) {
  const n = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(tasks)
    .values({ companyId, taskCode: `TSK-${n}`, title: `Task ${n}`, ...o })
    .returning();
  return row;
}
