// Deterministic data for browser tests. Run: pnpm e2e:seed  (uses TEST_DATABASE_URL, resets it first).
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export const E2E_PASSWORD = "e2e-password-123";
export const ADMIN_EMAIL = "admin@e2e.test";
export const EMPLOYEE_EMAIL = "employee@e2e.test";

async function main() {
  const { Pool } = await import("pg");
  const { runMigrations } = await import("../src/db/migrate");
  const url = process.env.TEST_DATABASE_URL!;
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.end();
  await runMigrations(url);

  const { db } = await import("../src/db");
  const { account } = await import("../src/db/schema");
  const { auth } = await import("../src/lib/auth/auth");
  const { ALL_PERMISSION_KEYS, SYSTEM_ROLES } = await import("../src/lib/permissions");
  const f = await import("../src/test/factories");
  const { createClient } = await import("../src/modules/clients");
  const { createProject } = await import("../src/modules/projects");
  const { createTask, changeTaskStatus } = await import("../src/modules/tasks");
  const { loadActor } = await import("../src/lib/auth/load-actor");
  const { addDays, todayInTz } = await import("../src/lib/dates");

  const company = await f.createCompany({ legalName: "Automora Tech Solutions LLP", displayName: "Automora", timezone: "Asia/Kolkata" });
  const hash = await (await auth.$context).password.hash(E2E_PASSWORD);
  const mkUser = async (email: string, name: string, keys: readonly string[], role: string) => {
    const u = await f.createUser(company.id, { email, name });
    await db.insert(account).values({ id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: hash });
    const e = await f.createEmployee(company.id, { userId: u.id, fullName: name, workEmail: email, designation: role });
    await f.grantPermissions(company.id, u.id, keys as never, role);
    return { user: u, employee: e };
  };
  const admin = await mkUser(ADMIN_EMAIL, "Asha Admin", ALL_PERMISSION_KEYS, "Super Admin (e2e)");
  const emp = await mkUser(EMPLOYEE_EMAIL, "Ravi Employee", SYSTEM_ROLES.Employee, "Employee (e2e)");

  const a = await loadActor(admin.user.id);
  const today = todayInTz(a.timezone);
  const client = await createClient(a, { name: "Northwind Traders", contactPerson: "Jo", email: "jo@northwind.test" });
  const project = await createProject(a, { name: "Northwind Website", type: "Client", clientId: client.id, ownerEmployeeId: admin.employee.id, dueDate: addDays(today, 20) });
  const { addMember } = await import("../src/modules/projects");
  await addMember(a, project.id, emp.employee.id);
  await createTask(a, { title: "Design homepage", projectId: project.id, priority: "High", dueDate: addDays(today, 2), assigneeIds: [emp.employee.id] });
  const late = await createTask(a, { title: "Fix login bug", projectId: project.id, priority: "Urgent", dueDate: addDays(today, -3), assigneeIds: [emp.employee.id] });
  await createTask(a, { title: "Write launch plan", projectId: project.id, priority: "Medium", dueDate: addDays(today, 9) });
  const done = await createTask(a, { title: "Set up hosting", projectId: project.id, priority: "Low", dueDate: addDays(today, -1), assigneeIds: [admin.employee.id] });
  for (const s of ["In Progress", "In Review", "Completed"] as const) await changeTaskStatus(a, done.id, s);
  const { createExpenseCategory } = await import("../src/modules/finance/expenses/categories");
  await createExpenseCategory(a, { name: "Software & Subscriptions" });
  void late;
  process.stdout.write(`seeded: ${ADMIN_EMAIL} / ${EMPLOYEE_EMAIL}\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
