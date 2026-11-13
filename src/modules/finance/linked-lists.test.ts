import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadActor } from "@/lib/auth/load-actor";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { createClient } from "@/modules/clients";
import { confirmReceipt, createInvoiceDraft, issueInvoice, listInvoices, listReceipts, recordReceipt } from "@/modules/finance";
import { createProject } from "@/modules/projects";
import { createCompany, createEmployee, createUser, grantPermissions } from "@/test/factories";

async function admin(companyId?: string) {
  const company = companyId ? { id: companyId } : await createCompany();
  const u = await createUser(company.id);
  const emp = await createEmployee(company.id, { userId: u.id });
  await grantPermissions(company.id, u.id, ALL_PERMISSION_KEYS as never, `Role ${randomUUID().slice(0, 6)}`);
  return { company, actor: await loadActor(u.id), emp };
}

/** An issued invoice for `clientId`/`projectId`, with one confirmed receipt on it. */
async function invoiceWithReceipt(actor: Awaited<ReturnType<typeof admin>>["actor"], clientId: string, projectId: string | null, amount: string) {
  const draft = await createInvoiceDraft(actor, {
    clientId,
    projectId,
    dueDate: "2099-12-31",
    idempotencyKey: randomUUID(),
    items: [{ description: "Work", quantity: "1", unitPrice: "1000.00", discount: "0", taxRate: "0" }],
  });
  const invoice = await issueInvoice(actor, draft.id);
  const r = await recordReceipt(actor, {
    invoiceId: invoice.id,
    amount,
    paymentDate: "2026-03-10",
    method: "bank_transfer",
    reference: "UTR1",
    status: "pending",
    idempotencyKey: randomUUID(),
  });
  await confirmReceipt(actor, r.id);
  return { invoice, receiptId: r.id };
}

describe("receipts and invoices linked to a client or project", () => {
  it("filters receipts by client and by project, through their invoice", async () => {
    const a = await admin();
    const clientA = await createClient(a.actor, { name: "Client A" });
    const clientB = await createClient(a.actor, { name: "Client B" });
    const projectA = await createProject(a.actor, { name: "Project A", type: "Client", clientId: clientA.id, ownerEmployeeId: a.emp.id });
    const one = await invoiceWithReceipt(a.actor, clientA.id, projectA.id, "100.00");
    const two = await invoiceWithReceipt(a.actor, clientA.id, null, "200.00");
    const three = await invoiceWithReceipt(a.actor, clientB.id, null, "300.00");

    const forA = await listReceipts(a.actor, { clientId: clientA.id });
    expect(forA.rows.map((r) => r.id).sort()).toEqual([one.receiptId, two.receiptId].sort());
    expect(forA.total).toBe(2);

    const forB = await listReceipts(a.actor, { clientId: clientB.id });
    expect(forB.rows.map((r) => r.id)).toEqual([three.receiptId]);

    const forProject = await listReceipts(a.actor, { projectId: projectA.id });
    expect(forProject.rows.map((r) => r.id)).toEqual([one.receiptId]);
    expect(forProject.total).toBe(1);

    // No filter still returns everything, and the count matches the rows.
    const all = await listReceipts(a.actor, {});
    expect(all.total).toBe(3);
  });

  it("filters invoices by client and project", async () => {
    const a = await admin();
    const client = await createClient(a.actor, { name: "Client" });
    const project = await createProject(a.actor, { name: "P", type: "Client", clientId: client.id, ownerEmployeeId: a.emp.id });
    const withProject = await invoiceWithReceipt(a.actor, client.id, project.id, "50.00");
    await invoiceWithReceipt(a.actor, client.id, null, "50.00");
    expect((await listInvoices(a.actor, { clientId: client.id, page: 1, pageSize: 10 })).total).toBe(2);
    const byProject = await listInvoices(a.actor, { projectId: project.id, page: 1, pageSize: 10 });
    expect(byProject.rows.map((r) => r.id)).toEqual([withProject.invoice.id]);
  });

  it("never returns another company's receipts, even when asked for their client", async () => {
    const mine = await admin();
    const theirs = await admin();
    const theirClient = await createClient(theirs.actor, { name: "Theirs" });
    await invoiceWithReceipt(theirs.actor, theirClient.id, null, "10.00");
    const res = await listReceipts(mine.actor, { clientId: theirClient.id });
    expect(res.rows).toEqual([]);
    expect(res.total).toBe(0);
  });

  it("rejects malformed ids", async () => {
    const a = await admin();
    await expect(listReceipts(a.actor, { clientId: "not-a-uuid" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
