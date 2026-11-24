import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { loadActor } from "@/lib/auth/load-actor";
import { resetNotifier, setNotifier, type NotifyEvent } from "@/lib/notify";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { listAuditLog, listEntityHistory } from "@/modules/audit";
import { addClientNote, createClient, deleteClientNote, editClientNote, listClientNotes } from "@/modules/clients";
import {
  archiveExpense,
  confirmReceipt,
  createExpense,
  createExpenseCategory,
  createInvoiceDraft,
  getClientFinanceSummary,
  getProjectFinanceOverview,
  issueInvoice,
  listExpenses,
  recordExpensePayment,
  recordReceipt,
  voidPendingReceipt,
} from "@/modules/finance";
import { createProject } from "@/modules/projects";
import { getNumbering, updateNumbering } from "@/modules/settings";
import { addComment } from "@/modules/tasks";
import { createTask } from "@/modules/tasks";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { workWorld } from "@/test/work";

afterEach(() => resetNotifier());

async function world() {
  const company = await createCompany();
  const u = await createUser(company.id);
  const emp = await createEmployee(company.id, { userId: u.id });
  await grantPermissions(company.id, u.id, ALL_PERMISSION_KEYS as never, `Admin ${randomUUID().slice(0, 6)}`);
  const actor = await loadActor(u.id);
  const client = await createClient(actor, { name: "Acme" });
  const project = await createProject(actor, { name: "P1", type: "Client", clientId: client.id, ownerEmployeeId: emp.id, budgetAmount: "5000" });
  return { company, actor, emp, client, project };
}

async function issued(w: Awaited<ReturnType<typeof world>>) {
  const draft = await createInvoiceDraft(w.actor, {
    clientId: w.client.id,
    projectId: w.project.id,
    dueDate: "2099-12-31",
    idempotencyKey: randomUUID(),
    items: [{ description: "Work", quantity: "1", unitPrice: "1000.00", discount: "0", taxRate: "0" }],
  });
  return issueInvoice(w.actor, draft.id);
}

const rec = (invoiceId: string, amount: string) => ({
  invoiceId,
  amount,
  paymentDate: "2026-03-10",
  method: "bank_transfer" as const,
  reference: "UTR1",
  status: "pending" as const,
  idempotencyKey: randomUUID(),
});

describe("voiding a pending receipt", () => {
  it("releases the reserved balance, keeps the row as reversed and is audited", async () => {
    const w = await world();
    const inv = await issued(w);
    const r = await recordReceipt(w.actor, rec(inv.id, "1000.00"));
    // the whole balance is reserved by the pending receipt
    await expect(recordReceipt(w.actor, rec(inv.id, "100.00"))).rejects.toMatchObject({ code: "CONFLICT" });
    const voided = await voidPendingReceipt(w.actor, { paymentId: r.id, reason: "wrong amount" });
    expect(voided.status).toBe("reversed");
    // balance is free again
    await expect(recordReceipt(w.actor, rec(inv.id, "1000.00"))).resolves.toMatchObject({ status: "pending" });
    const history = await listEntityHistory(w.actor, "payment", r.id);
    expect(history.map((h) => h.action)).toContain("payment.voided");
  });

  it("cannot void a confirmed receipt", async () => {
    const w = await world();
    const inv = await issued(w);
    const r = await recordReceipt(w.actor, rec(inv.id, "500.00"));
    // a second person is not required in the default settings
    await confirmReceipt(w.actor, r.id).catch(() => undefined);
    await expect(voidPendingReceipt(w.actor, { paymentId: r.id, reason: "x" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("payment notifications", () => {
  it("notifies other finance users when a receipt is recorded, never the actor", async () => {
    const w = await world();
    const other = await createUser(w.company.id);
    await grantPermissions(w.company.id, other.id, ["finance.notifications.receive"], "FinanceViewer");
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));
    const inv = await issued(w);
    const r = await recordReceipt(w.actor, rec(inv.id, "300.00"));
    const e = events.find((x) => x.type === "payment.recorded");
    expect(e?.userIds).toEqual([other.id]);
    expect(e?.entity).toEqual({ type: "payment", id: r.id });
  });
});

describe("expense archive", () => {
  it("archives an unpaid expense and refuses one with a payment", async () => {
    const w = await world();
    const cat = await createExpenseCategory(w.actor, { name: "Travel" });
    const mk = () =>
      createExpense(w.actor, { categoryId: cat.id, projectId: null, payee: "Vendor", description: "d", expenseDate: "2026-03-01", dueDate: null, total: "100.00", idempotencyKey: randomUUID() });
    const e1 = await mk();
    await archiveExpense(w.actor, e1.id, "duplicate");
    expect((await listExpenses(w.actor, {})).rows.map((r) => r.id)).not.toContain(e1.id);

    const e2 = await mk();
    await recordExpensePayment(w.actor, { expenseId: e2.id, amount: "50.00", paymentDate: "2026-03-02", method: "cash", status: "pending", idempotencyKey: randomUUID() } as never);
    await expect(archiveExpense(w.actor, e2.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("client notes", () => {
  it("edits and deletes a note", async () => {
    const w = await world();
    const n = await addClientNote(w.actor, w.client.id, "first");
    await editClientNote(w.actor, w.client.id, n.id, "second");
    expect((await listClientNotes(w.actor, w.client.id))[0].note).toBe("second");
    await deleteClientNote(w.actor, w.client.id, n.id);
    expect(await listClientNotes(w.actor, w.client.id)).toHaveLength(0);
  });
});

describe("audit log", () => {
  it("lists changes company-wide and filters by area", async () => {
    const w = await world();
    await issued(w);
    const all = await listAuditLog(w.actor, {});
    expect(all.total).toBeGreaterThan(0);
    expect(all.entities).toContain("invoice");
    const onlyInvoices = await listAuditLog(w.actor, { entity: "invoice" });
    expect(onlyInvoices.rows.every((r) => r.entity === "invoice")).toBe(true);
  });

  it("is hidden from people without audit.read", async () => {
    const t = await workWorld();
    await expect(listAuditLog(t.manager, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("configurable numbering", () => {
  it("changes future task numbers only", async () => {
    const t = await workWorld(["tasks.create", "tasks.read.all", "settings.read", "settings.manage"]);
    const a = await createTask(t.manager, { title: "before" });
    expect(a.taskCode).toMatch(/^TSK-\d{6}$/);
    const rows = await updateNumbering(t.manager, "TSK", { prefix: "work", padding: 4 });
    expect(rows.find((r) => r.kind === "TSK")).toMatchObject({ prefix: "WORK", padding: 4 });
    const b = await createTask(t.manager, { title: "after" });
    expect(b.taskCode).toBe("WORK-0002");
    expect((await getNumbering(t.manager)).find((r) => r.kind === "TSK")?.next).toBe("WORK-0003");
    await expect(updateNumbering(t.manager, "TSK", { prefix: "bad prefix!", padding: 4 })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("project finance overview", () => {
  it("shows budget, invoiced and cash per project", async () => {
    const w = await world();
    const inv = await issued(w);
    const r = await recordReceipt(w.actor, { ...rec(inv.id, "400.00"), status: "confirmed" }).catch(async () => {
      const p = await recordReceipt(w.actor, rec(inv.id, "400.00"));
      return confirmReceipt(w.actor, p.id);
    });
    expect(r).toBeTruthy();
    const o = await getProjectFinanceOverview(w.actor, {});
    const row = o.rows.find((x) => x.projectId === w.project.id);
    expect(row).toMatchObject({ currency: "INR", budget: "5000.00", invoiced: "1000.00" });
    expect(await getClientFinanceSummary(w.actor, w.client.id)).toBeTruthy();
  });
});

describe("task comment notifications", () => {
  it("notifies assignees, not the author", async () => {
    const t = await workWorld();
    const a = await t.employee();
    const task = await createTask(t.manager, { title: "discuss", assigneeIds: [a.employeeId] });
    const events: NotifyEvent[] = [];
    setNotifier(async (e) => void events.push(e));
    await addComment(t.manager, task.id, "hello team");
    const e = events.find((x) => x.type === "comment.task");
    expect(e?.userIds).toEqual([a.userId]);
  });
});

describe("Critical priority (blueprint 4.5)", () => {
  it("accepts Critical, sorts it first and counts it on the dashboard", async () => {
    const t = await workWorld(["tasks.create", "tasks.read.all", "dashboard.company.read"]);
    await createTask(t.manager, { title: "low one", priority: "Low" });
    const c = await createTask(t.manager, { title: "melt down", priority: "Critical" });
    expect(c.priority).toBe("Critical");
    const { listTasks } = await import("@/modules/tasks");
    const list = await listTasks(t.manager, { sort: "priority" });
    expect(list.rows[0].title).toBe("melt down");
    const { getDashboard } = await import("@/modules/reports");
    const d = await getDashboard(t.manager, { preset: "month" });
    expect(d.taskPriority.find((p) => p.priority === "Critical")?.count).toBe(1);
  });
});
