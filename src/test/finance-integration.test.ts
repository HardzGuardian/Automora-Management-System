import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, payments } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES } from "@/lib/permissions";
import { createClient } from "@/modules/clients";
import {
  addInvoiceLine,
  confirmExpensePayment,
  confirmReceipt,
  createExpense,
  createExpenseCategory,
  createInvoiceDraft,
  getClientFinanceSummary,
  getProjectFinanceSummary,
  issueInvoice,
  recordExpensePayment,
  recordReceipt,
  reverseReceipt,
} from "@/modules/finance";
import { createProject } from "@/modules/projects";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";

async function tenant(keys: readonly string[] = ALL_PERMISSION_KEYS) {
  const company = await createCompany();
  const u = await createUser(company.id);
  const emp = await createEmployee(company.id, { userId: u.id });
  await grantPermissions(company.id, u.id, keys as never, `Role ${randomUUID().slice(0, 6)}`);
  const actor = await loadActor(u.id);
  return { company, actor, emp };
}

/** Admin with every permission, plus a client and a project owned by the same company. */
async function financeWorld() {
  const t = await tenant();
  const client = await createClient(t.actor, { name: "Billed Client" });
  const project = await createProject(t.actor, { name: "Billed Project", type: "Client", clientId: client.id, ownerEmployeeId: t.emp.id });
  return { ...t, client, project };
}

const line = { description: "Design work", quantity: "2", unitPrice: "1000.00", discount: "0", taxRate: "18" }; // 2000 + 18% = 2360.00

async function issuedInvoice(w: Awaited<ReturnType<typeof financeWorld>>) {
  const draft = await createInvoiceDraft(w.actor, { clientId: w.client.id, projectId: w.project.id, dueDate: "2026-04-10", idempotencyKey: randomUUID(), items: [line] });
  const issued = await issueInvoice(w.actor, draft.id);
  return { draft, issued };
}

const receipt = (invoiceId: string, amount: string, status: "pending" | "confirmed" = "pending") => ({
  invoiceId,
  amount,
  paymentDate: "2026-03-10",
  method: "bank_transfer" as const,
  reference: "UTR123456",
  status,
  idempotencyKey: randomUUID(),
});

describe("invoice → receipt → client summary (finance on top of the shared foundation)", () => {
  it("drafts, issues with a number, and reports outstanding receivables", async () => {
    const w = await financeWorld();
    const { draft, issued } = await issuedInvoice(w);
    expect(draft.total).toBe("2360.00");
    expect(issued.status).toBe("issued");
    expect(issued.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    const s = await getClientFinanceSummary(w.actor, w.client.id);
    expect(s.outstandingByCurrency).toEqual([{ currency: "INR", amount: "2360.00" }]);
  });

  it("numbers invoices sequentially per company", async () => {
    const w = await financeWorld();
    const a = (await issuedInvoice(w)).issued.invoiceNumber;
    const b = (await issuedInvoice(w)).issued.invoiceNumber;
    const seq = (n: string | null) => Number(n!.split("-")[2]);
    expect(seq(b)).toBe(seq(a) + 1);
  });

  it("takes partial payments and reverses them, keeping the audit trail", async () => {
    const w = await financeWorld();
    const { issued } = await issuedInvoice(w);
    const r1 = await recordReceipt(w.actor, receipt(issued.id, "1000.00"));
    expect(r1.status).toBe("pending");
    // pending receipts do not reduce the outstanding balance
    expect((await getClientFinanceSummary(w.actor, w.client.id)).outstandingByCurrency[0].amount).toBe("2360.00");
    await confirmReceipt(w.actor, r1.id);
    expect((await getClientFinanceSummary(w.actor, w.client.id)).outstandingByCurrency[0].amount).toBe("1360.00");

    const r2 = await recordReceipt(w.actor, receipt(issued.id, "1360.00", "confirmed"));
    expect(r2.status).toBe("confirmed");
    expect((await getClientFinanceSummary(w.actor, w.client.id)).outstandingByCurrency.map((x) => x.amount)).toEqual(["0.00"]);

    await reverseReceipt(w.actor, { paymentId: r2.id, reason: "Cheque bounced" });
    expect((await getClientFinanceSummary(w.actor, w.client.id)).outstandingByCurrency[0].amount).toBe("1360.00");

    const actions = (await db.select().from(activityLogs).where(eq(activityLogs.companyId, w.company.id))).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["invoice.issued", "payment.confirmed", "payment.reversed"]));
  });

  it("rejects overpayment", async () => {
    const w = await financeWorld();
    const { issued } = await issuedInvoice(w);
    await expect(recordReceipt(w.actor, receipt(issued.id, "2360.01", "confirmed"))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("is idempotent: the same key creates one payment", async () => {
    const w = await financeWorld();
    const { issued } = await issuedInvoice(w);
    const input = receipt(issued.id, "500.00");
    const a = await recordReceipt(w.actor, input);
    const b = await recordReceipt(w.actor, input);
    expect(b.id).toBe(a.id);
    expect(await db.select().from(payments).where(eq(payments.invoiceId, issued.id))).toHaveLength(1);
  });

  it("lets only one of two simultaneous confirmations win (no double count)", async () => {
    const w = await financeWorld();
    const { issued } = await issuedInvoice(w);
    const r = await recordReceipt(w.actor, receipt(issued.id, "1000.00"));
    const results = await Promise.allSettled([confirmReceipt(w.actor, r.id), confirmReceipt(w.actor, r.id)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await getClientFinanceSummary(w.actor, w.client.id)).outstandingByCurrency[0].amount).toBe("1360.00");
  });

  it("supports editing a draft before issue (lines are totalled correctly)", async () => {
    const w = await financeWorld();
    const draft = await createInvoiceDraft(w.actor, { clientId: w.client.id, idempotencyKey: randomUUID(), items: [] });
    expect(draft.total).toBe("0.00");
    const withLine = await addInvoiceLine(w.actor, draft.id, { description: "Hosting", quantity: "1", unitPrice: "100.50", discount: "0", taxRate: "0" });
    expect(withLine.total).toBe("100.50");
  });
});

describe("expenses and the project cash summary", () => {
  it("records, confirms and reports project-linked expense payments", async () => {
    const w = await financeWorld();
    const { issued } = await issuedInvoice(w);
    await confirmReceipt(w.actor, (await recordReceipt(w.actor, receipt(issued.id, "2360.00"))).id);

    const category = await createExpenseCategory(w.actor, { name: `Cat ${randomUUID().slice(0, 6)}` });
    const expense = await createExpense(w.actor, {
      categoryId: category.id,
      projectId: w.project.id,
      payee: "Cloud Vendor",
      description: "Hosting",
      expenseDate: "2026-03-05",
      total: "500.00",
      idempotencyKey: randomUUID(),
    } as never);
    expect(expense.expenseCode).toMatch(/^EXP-\d{6}$/);

    const pending = await recordExpensePayment(w.actor, {
      expenseId: expense.id,
      amount: "300.00",
      paymentDate: "2026-03-06",
      method: "bank_transfer",
      reference: "UTR9",
      status: "pending",
      idempotencyKey: randomUUID(),
    });
    // The confirm path used a stale helper name before integration; this is the regression test.
    const confirmed = await confirmExpensePayment(w.actor, pending.id);
    expect(confirmed.status).toBe("confirmed");

    const summary = await getProjectFinanceSummary(w.actor, w.project.id);
    expect(summary.currencies).toEqual([
      { currency: "INR", confirmedReceipts: "2360.00", confirmedExpensePayments: "300.00", netCashMovement: "2060.00" },
    ]);
  });
});

describe("permissions and isolation", () => {
  it("the default Manager role has no finance access at all", async () => {
    const w = await financeWorld();
    const manager = await tenant(SYSTEM_ROLES.Manager);
    const { issued } = await issuedInvoice(w);
    void issued;
    const m = manager.actor;
    await expect(createInvoiceDraft(m, { clientId: randomUUID(), idempotencyKey: randomUUID(), items: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordReceipt(m, receipt(randomUUID(), "1.00"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(confirmReceipt(m, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClientFinanceSummary(m, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getProjectFinanceSummary(m, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("another company's finance admin cannot see or touch this company's records", async () => {
    const w = await financeWorld();
    const attacker = await tenant();
    const { issued } = await issuedInvoice(w);
    const r = await recordReceipt(w.actor, receipt(issued.id, "100.00"));
    const a = attacker.actor;
    const code = (p: Promise<unknown>) => p.then(() => "OK", (e: { code: string }) => e.code);
    expect(await code(getClientFinanceSummary(a, w.client.id))).toMatch(/NOT_FOUND$/);
    expect(await code(getProjectFinanceSummary(a, w.project.id))).toMatch(/NOT_FOUND$/);
    expect(await code(issueInvoice(a, issued.id))).toMatch(/NOT_FOUND$/);
    expect(await code(confirmReceipt(a, r.id))).toMatch(/NOT_FOUND$/);
    expect(await code(recordReceipt(a, receipt(issued.id, "10.00")))).toMatch(/NOT_FOUND$/);
    expect(await code(createInvoiceDraft(a, { clientId: w.client.id, idempotencyKey: randomUUID(), items: [] }))).toMatch(/NOT_FOUND$/);
  });
});
