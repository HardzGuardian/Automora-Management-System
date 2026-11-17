import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { expensePayments, payments } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { createClient } from "@/modules/clients";
import {
  confirmExpensePayment,
  confirmReceipt,
  createExpense,
  createExpenseCategory,
  createInvoiceDraft,
  getReceiptDetail,
  issueInvoice,
  listExpensePayments,
  recordExpensePayment,
  recordReceipt,
} from "@/modules/finance";
import { updatePreferences } from "@/modules/settings";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";

async function userIn(companyId: string) {
  const u = await createUser(companyId);
  await createEmployee(companyId, { userId: u.id });
  await grantPermissions(companyId, u.id, ALL_PERMISSION_KEYS as never, `Role ${randomUUID().slice(0, 6)}`);
  return loadActor(u.id);
}

/** One company with two finance users (alice records, bob is the second person), an issued invoice and an expense. */
async function world() {
  const company = await createCompany();
  const alice = await userIn(company.id);
  const bob = await userIn(company.id);
  const client = await createClient(alice, { name: "Client" });
  const draft = await createInvoiceDraft(alice, {
    clientId: client.id,
    dueDate: "2099-12-31",
    idempotencyKey: randomUUID(),
    items: [{ description: "Work", quantity: "1", unitPrice: "1000.00", discount: "0", taxRate: "0" }],
  });
  const invoice = await issueInvoice(alice, draft.id);
  const category = await createExpenseCategory(alice, { name: `Cat ${randomUUID().slice(0, 6)}` });
  const expense = await createExpense(alice, {
    categoryId: category.id,
    payee: "Vendor",
    description: "d",
    expenseDate: "2026-03-05",
    total: "500.00",
    idempotencyKey: randomUUID(),
  } as never);
  const setRule = (on: boolean) => updatePreferences(alice, { "finance.requireSecondConfirmer": on });
  return { company, alice, bob, invoice, expense, setRule };
}

type World = Awaited<ReturnType<typeof world>>;

const receipt = (w: World, status: "pending" | "confirmed" = "pending") => ({
  invoiceId: w.invoice.id,
  amount: "100.00",
  paymentDate: "2026-03-10",
  method: "bank_transfer" as const,
  reference: "UTR123456",
  status,
  idempotencyKey: randomUUID(),
});
const outgoing = (w: World, status: "pending" | "confirmed" = "pending") => ({
  expenseId: w.expense.id,
  amount: "50.00",
  paymentDate: "2026-03-10",
  method: "cash" as const,
  reference: "CASH-1",
  status,
  idempotencyKey: randomUUID(),
});

const receiptStatus = async (id: string) => (await db.select({ s: payments.status }).from(payments).where(eq(payments.id, id)))[0].s;
const expenseStatus = async (id: string) => (await db.select({ s: expensePayments.status }).from(expensePayments).where(eq(expensePayments.id, id)))[0].s;

describe("second-person confirmation (off by default)", () => {
  it("lets the same person record and confirm when the rule is off", async () => {
    const w = await world();
    const r = await recordReceipt(w.alice, receipt(w));
    expect((await confirmReceipt(w.alice, r.id)).status).toBe("confirmed");
    const p = await recordExpensePayment(w.alice, outgoing(w));
    expect((await confirmExpensePayment(w.alice, p.id)).status).toBe("confirmed");
    expect((await recordReceipt(w.alice, receipt(w, "confirmed"))).status).toBe("confirmed");
  });
});

describe("second-person confirmation (rule on)", () => {
  it("blocks self-confirming a receipt, but lets someone else confirm it", async () => {
    const w = await world();
    await w.setRule(true);
    const r = await recordReceipt(w.alice, receipt(w));
    await expect(confirmReceipt(w.alice, r.id)).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("different person") });
    expect(await receiptStatus(r.id)).toBe("pending");
    expect((await confirmReceipt(w.bob, r.id)).status).toBe("confirmed");
    expect(await receiptStatus(r.id)).toBe("confirmed");
  });

  it("blocks self-confirming an outgoing payment, but lets someone else confirm it", async () => {
    const w = await world();
    await w.setRule(true);
    const p = await recordExpensePayment(w.alice, outgoing(w));
    await expect(confirmExpensePayment(w.alice, p.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await expenseStatus(p.id)).toBe("pending");
    expect((await confirmExpensePayment(w.bob, p.id)).status).toBe("confirmed");
  });

  it("blocks recording a payment as already confirmed (that is self-confirming)", async () => {
    const w = await world();
    await w.setRule(true);
    await expect(recordReceipt(w.alice, receipt(w, "confirmed"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordExpensePayment(w.alice, outgoing(w, "confirmed"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Recording as pending still works for the same person.
    expect((await recordReceipt(w.alice, receipt(w))).status).toBe("pending");
  });

  it("tells the pages who is waiting on whom", async () => {
    const w = await world();
    await w.setRule(true);
    const r = await recordReceipt(w.alice, receipt(w));
    const p = await recordExpensePayment(w.alice, outgoing(w));
    expect((await getReceiptDetail(w.alice, r.id)).awaitingSecondPerson).toBe(true);
    expect((await getReceiptDetail(w.bob, r.id)).awaitingSecondPerson).toBe(false);
    expect((await listExpensePayments(w.alice, w.expense.id))[0].awaitingSecondPerson).toBe(true);
    expect((await listExpensePayments(w.bob, w.expense.id))[0].awaitingSecondPerson).toBe(false);
    await confirmReceipt(w.bob, r.id);
    await confirmExpensePayment(w.bob, p.id);
    expect((await getReceiptDetail(w.alice, r.id)).awaitingSecondPerson).toBe(false); // no longer pending
  });

  it("applies per company, and switching it off restores self-confirmation", async () => {
    const w = await world();
    const other = await world(); // rule stays off here
    await w.setRule(true);
    const mine = await recordReceipt(w.alice, receipt(w));
    await expect(confirmReceipt(w.alice, mine.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const theirs = await recordReceipt(other.alice, receipt(other));
    expect((await confirmReceipt(other.alice, theirs.id)).status).toBe("confirmed");

    await w.setRule(false);
    expect((await confirmReceipt(w.alice, mine.id)).status).toBe("confirmed");
  });
});
