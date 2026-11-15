import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { addDays, todayInTz } from "@/lib/dates";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";
import { createClient } from "@/modules/clients";
import { cancelInvoice, createInvoiceDraft, issueInvoice, recordReceipt } from "@/modules/finance";

async function setup() {
  const company = await createCompany();
  const u = await createUser(company.id);
  await createEmployee(company.id, { userId: u.id });
  await grantPermissions(company.id, u.id, [...ALL_PERMISSION_KEYS], "Finance admin");
  const fin = await loadActor(u.id);
  const client = await createClient(fin, { name: "Billed" });
  const today = todayInTz(fin.timezone);
  const draft = (due: string) =>
    createInvoiceDraft(fin, { clientId: client.id, dueDate: due, idempotencyKey: randomUUID(), items: [{ description: "x", quantity: "1", unitPrice: "100.00", discount: "0", taxRate: "0" }] });
  return { fin, today, draft };
}

describe("invoice and payment date rules", () => {
  it("will not issue an invoice whose due date is already past", async () => {
    const s = await setup();
    const d = await s.draft(addDays(s.today, -1));
    await expect(issueInvoice(s.fin, d.id)).rejects.toMatchObject({ code: "VALIDATION" });
    const ok = await s.draft(s.today);
    await expect(issueInvoice(s.fin, ok.id)).resolves.toBeTruthy(); // due today is fine
  });

  it("will not record a receipt dated in the future", async () => {
    const s = await setup();
    const inv = await issueInvoice(s.fin, (await s.draft(addDays(s.today, 10))).id);
    const base = { invoiceId: inv.id, amount: "10.00", method: "cash" as const, status: "pending" as const };
    await expect(recordReceipt(s.fin, { ...base, paymentDate: addDays(s.today, 1), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordReceipt(s.fin, { ...base, paymentDate: s.today, idempotencyKey: randomUUID() })).resolves.toBeTruthy();
  });

  it("still takes receipts and allows cancelling once an issued invoice has gone overdue", async () => {
    const s = await setup();
    const inv = await issueInvoice(s.fin, (await s.draft(addDays(s.today, 3))).id);
    await db.update(invoices).set({ dueDate: addDays(s.today, -5) }).where(eq(invoices.id, inv.id)); // time passes
    const r = await recordReceipt(s.fin, { invoiceId: inv.id, amount: "20.00", method: "cash", status: "pending", paymentDate: s.today, idempotencyKey: randomUUID() });
    expect(r).toBeTruthy();
    const other = await issueInvoice(s.fin, (await s.draft(addDays(s.today, 3))).id);
    await db.update(invoices).set({ dueDate: addDays(s.today, -5) }).where(eq(invoices.id, other.id));
    await expect(cancelInvoice(s.fin, { invoiceId: other.id, reason: "entered twice" })).resolves.toBeTruthy();
  });
});
