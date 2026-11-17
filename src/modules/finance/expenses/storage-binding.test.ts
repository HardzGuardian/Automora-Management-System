import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadActor } from "@/lib/auth/load-actor";
import { readFile } from "@/modules/files";
import { buildActor, createCompany, createUser, grantPermissions } from "@/test/factories";
import { createExpenseCategory } from "./categories";
import { canAccessExpenseAttachment } from "./file-access";
import { createExpense } from "./service";
import { expenseAttachmentService } from "./storage-binding";

const PDF = new TextEncoder().encode("%PDF-1.7\nreceipt body\n%%EOF\n");

async function world() {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, ["finance.expenses.read", "finance.expenses.create", "finance.expenses.update", "finance.categories.manage"], "Finance");
  const actor = await loadActor(u.id);
  const category = await createExpenseCategory(actor, { name: `Cat ${randomUUID().slice(0, 6)}` });
  const expense = await createExpense(actor, {
    categoryId: category.id,
    payee: "Vendor",
    description: "Hosting",
    expenseDate: "2026-03-05",
    total: "500.00",
    idempotencyKey: randomUUID(),
  } as never);
  const att = await expenseAttachmentService.attachExpenseFile(
    actor,
    expense.id,
    { fileName: "receipt.pdf", contentType: "application/pdf", size: PDF.byteLength },
    PDF,
  );
  return { company, actor, expense, att };
}

describe("finance expense attachment download", () => {
  it("lets a finance user download the receipt through the shared files module", async () => {
    const w = await world();
    const file = await readFile(w.actor, w.att.id, [canAccessExpenseAttachment]);
    expect(Buffer.from(file.bytes).equals(Buffer.from(PDF))).toBe(true);
    expect(file).toMatchObject({ name: "receipt.pdf", mime: "application/pdf" });
  });

  it("lists attachments and returns an authenticated download URL", async () => {
    const w = await world();
    const list = await expenseAttachmentService.listExpenseFiles(w.actor, w.expense.id);
    expect(list.map((f) => f.id)).toEqual([w.att.id]);
    const { url } = await expenseAttachmentService.getExpenseFileDownloadUrl(w.actor, w.expense.id, w.att.id);
    expect(url).toBe(`/api/files/${w.att.id}`);
  });

  it("hides the file (NOT_FOUND) from a user without finance.expenses.read", async () => {
    const w = await world();
    const u = await createUser(w.company.id);
    await grantPermissions(w.company.id, u.id, ["finance.invoices.read"], "Employee");
    const employee = await loadActor(u.id);
    await expect(readFile(employee, w.att.id, [canAccessExpenseAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides the file (NOT_FOUND) from another company, even with finance permission", async () => {
    const w = await world();
    const other = await createCompany();
    const u = await createUser(other.id);
    await grantPermissions(other.id, u.id, ["finance.expenses.read"], "Finance");
    await expect(readFile(await loadActor(u.id), w.att.id, [canAccessExpenseAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const forged = buildActor({ companyId: w.company.id });
    await expect(readFile(forged, w.att.id, [canAccessExpenseAttachment])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
