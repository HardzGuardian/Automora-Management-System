import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { addDays, todayInTz } from "@/lib/dates";
import { resetNotifier } from "@/lib/notify";
import { confirmReceipt, createInvoiceDraft, issueInvoice, recordReceipt } from "@/modules/finance";
import { createProject } from "@/modules/projects";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { loadActor } from "@/lib/auth/load-actor";
import { createClient } from "@/modules/clients";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { workWorld } from "@/test/work";
import { GET as remindersGET } from "@/app/api/cron/reminders/route";
import { GET as invoiceGET } from "@/app/api/cron/invoice-due/route";
import { runReminders } from "./reminders";
import { registerNotifier } from "./service";

afterEach(() => resetNotifier());
const SECRET = "test-cron-secret-0123456789";
const req = (auth?: string) => new Request("http://localhost/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });

describe("cron route authentication", () => {
  it("rejects missing, wrong and malformed secrets; accepts the right one", async () => {
    expect((await remindersGET(req())).status).toBe(401);
    expect((await remindersGET(req("Bearer nope"))).status).toBe(401);
    expect((await remindersGET(req(SECRET))).status).toBe(401); // missing "Bearer "
    expect((await remindersGET(req(`Bearer ${SECRET}x`))).status).toBe(401);
    expect((await invoiceGET(req())).status).toBe(401);
    const ok = await remindersGET(req(`Bearer ${SECRET}`));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(await ok.json()).toMatchObject({ failures: [] });
    expect((await invoiceGET(req(`Bearer ${SECRET}`))).status).toBe(200);
  });
});

describe("project reminders", () => {
  it("notifies the owner of a project due soon or past due, once per day, and ignores finished ones", async () => {
    registerNotifier();
    const w = await workWorld(["projects.create", "projects.read.all", "projects.update", "employees.read", "tasks.create", "tasks.read.all"] as never[]);
    const ownerUser = await createUser(w.company.id);
    const owner = await createEmployee(w.company.id, { userId: ownerUser.id });
    const today = todayInTz(w.manager.timezone);
    const soon = await createProject(w.manager, { name: "Soon", type: "Internal", ownerEmployeeId: owner.id, dueDate: addDays(today, 2) });
    await createProject(w.manager, { name: "Late", type: "Internal", ownerEmployeeId: owner.id, dueDate: addDays(today, -1) });
    await createProject(w.manager, { name: "Far", type: "Internal", ownerEmployeeId: owner.id, dueDate: addDays(today, 30) });
    const done = await createProject(w.manager, { name: "Done", type: "Internal", ownerEmployeeId: owner.id, dueDate: addDays(today, -1) });
    const { changeProjectStatus } = await import("@/modules/projects");
    for (const s of ["Active", "Completed"] as const) await changeProjectStatus(w.manager, done.id, s);

    await runReminders({ companyId: w.company.id, sections: ["projects"] });
    await runReminders({ companyId: w.company.id, sections: ["projects"] });
    const titles = (await db.select().from(notifications).where(eq(notifications.userId, ownerUser.id))).map((n) => n.title).sort();
    expect(titles).toEqual(["Project due soon: Soon", "Project past its due date: Late"]);
    void soon;
  });
});

describe("invoice reminders", () => {
  it("notifies finance users about overdue and soon-due invoices, never about paid ones, and never non-finance users", async () => {
    registerNotifier();
    const company = await createCompany();
    const finUser = await createUser(company.id);
    const finEmp = await createEmployee(company.id, { userId: finUser.id });
    await grantPermissions(company.id, finUser.id, [...ALL_PERMISSION_KEYS], "Finance admin");
    const fin = await loadActor(finUser.id);
    const plain = await createUser(company.id);
    await grantPermissions(company.id, plain.id, ["dashboard.personal.read"], "Plain");
    const client = await createClient(fin, { name: "Billed" });
    const today = todayInTz(fin.timezone);
    const mk = async (due: string) => {
      const d = await createInvoiceDraft(fin, { clientId: client.id, dueDate: due, idempotencyKey: randomUUID(), items: [{ description: "x", quantity: "1", unitPrice: "100.00", discount: "0", taxRate: "0" }] });
      return issueInvoice(fin, d.id);
    };
    await mk(addDays(today, -5)); // overdue
    await mk(addDays(today, 2)); // due soon
    await mk(addDays(today, 60)); // far
    const paid = await mk(addDays(today, -9));
    await confirmReceipt(fin, (await recordReceipt(fin, { invoiceId: paid.id, amount: "100.00", paymentDate: today, method: "cash", status: "pending", idempotencyKey: randomUUID() })).id);
    void finEmp;

    await runReminders({ companyId: company.id, sections: ["invoices"] });
    await runReminders({ companyId: company.id, sections: ["invoices"] });
    const mine = (await db.select().from(notifications).where(eq(notifications.userId, finUser.id))).map((n) => n.type).sort();
    expect(mine).toEqual(["invoice.due", "invoice.overdue"]);
    expect(await db.select().from(notifications).where(eq(notifications.userId, plain.id))).toHaveLength(0);
  });
});
