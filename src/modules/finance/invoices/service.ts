import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ZodType } from "zod";
import { withTransaction } from "@/db";
import { audit } from "@/modules/audit";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { todayInTz } from "@/lib/dates";
import { beginIdempotentOperation, completeIdempotentOperation } from "@/lib/idempotency/with-idempotency";
import { calcInvoice } from "./calc";
import {
  createInvoiceDraftSchema,
  invoiceDraftDtoSchema,
  invoiceLineInputSchema,
  removeInvoiceLineSchema,
  updateInvoiceDraftSchema,
  updateInvoiceLineSchema,
  issueInvoiceSchema,
  cancelInvoiceSchema,
  type CreateInvoiceDraftInput,
  type InvoiceLineInputDTO,
  type UpdateInvoiceDraftInput,
  type UpdateInvoiceLineInput,
  type IssueInvoiceInput,
  type CancelInvoiceInput,
} from "./schemas";
import { nextInvoiceNumber } from "./numbering";
import { transitionInvoiceState } from "./state-machine";
import {
  companies,
  clients,
  invoiceItems,
  invoices,
  projects,
  paymentAllocations,
  payments,
} from "@/db/schema";

export type InvoiceDraftDTO = {
  id: string;
  clientId: string;
  projectId: string | null;
  invoiceNumber: string | null;
  status: "draft";
  dueDate: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    taxRate: string;
    subtotal: string;
    taxAmount: string;
    lineTotal: string;
  }>;
};

export type IssuedInvoiceDTO = Omit<InvoiceDraftDTO, "status" | "invoiceNumber"> & {
  status: "issued";
  invoiceNumber: string;
  issueDate: string;
};

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Invoice input is invalid.", parsed.error.flatten());
  return parsed.data;
}

function toCalculationLines(items: readonly InvoiceLineInputDTO[]) {
  return items.map((item) => ({
    quantity: item.quantity,
    unitPriceMinor: toMinor(item.unitPrice),
    discountMinor: toMinor(item.discount),
    taxRate: item.taxRate,
  }));
}

function calculateItemRows(companyId: string, invoiceId: string, items: readonly InvoiceLineInputDTO[]) {
  let calculations: ReturnType<typeof calcInvoice>;
  try {
    calculations = calcInvoice(toCalculationLines(items));
  } catch (error) {
    if (error instanceof Error) throw new DomainError("VALIDATION", error.message);
    throw new DomainError("VALIDATION", "Invoice line calculations are invalid.");
  }
  return {
    calculated: calculations,
    rows: calculations.lines.map((line, position) => ({
      companyId,
      invoiceId,
      description: items[position]?.description ?? "",
      quantity: line.quantity,
      unitPrice: fromMinor(line.unitPriceMinor),
      discount: fromMinor(line.discountMinor),
      taxRate: line.taxRate,
      subtotal: fromMinor(line.subtotalMinor),
      taxAmount: fromMinor(line.taxMinor),
      lineTotal: fromMinor(line.totalMinor),
      position,
    })),
  };
}

async function validateReferences(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  clientId: string,
  projectId: string | null | undefined,
): Promise<void> {
  const [client] = await tx.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId))).limit(1);
  if (!client) throw new DomainError("CLIENT_NOT_FOUND", "Client was not found.");

  if (projectId) {
    const [project] = await tx.select({ id: projects.id, clientId: projects.clientId }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId))).limit(1);
    if (!project || project.clientId !== clientId) {
      throw new DomainError("PROJECT_NOT_FOUND", "Project was not found for this client.");
    }
  }
}

async function loadInvoiceDraft(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  invoiceId: string,
  lock = false,
): Promise<InvoiceDraftDTO> {
  const invoiceRows = lock
    ? await tx.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1)
      .for("update")
    : await tx.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);
  const invoice = invoiceRows[0];
  if (!invoice) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");
  if (invoice.status !== "draft") throw new DomainError("CONFLICT", "Only draft invoices can be changed.");

  const rows = await tx.select().from(invoiceItems)
    .where(and(eq(invoiceItems.invoiceId, invoiceId), eq(invoiceItems.companyId, companyId)))
    .orderBy(asc(invoiceItems.position));
  return {
    id: invoice.id,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    invoiceNumber: invoice.invoiceNumber,
    status: "draft",
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    items: rows.map((row) => ({
      id: row.id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      discount: row.discount,
      taxRate: row.taxRate,
      subtotal: row.subtotal,
      taxAmount: row.taxAmount,
      lineTotal: row.lineTotal,
    })),
  };
}

async function recomputeDraftTotals(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  invoiceId: string,
  actorId: string,
): Promise<void> {
  const rows = await tx.select().from(invoiceItems)
    .where(and(eq(invoiceItems.invoiceId, invoiceId), eq(invoiceItems.companyId, companyId)))
    .orderBy(asc(invoiceItems.position));
  const calculations = calcInvoice(rows.map((row) => ({
    quantity: row.quantity,
    unitPriceMinor: toMinor(row.unitPrice),
    discountMinor: toMinor(row.discount),
    taxRate: row.taxRate,
  })));
  await tx.update(invoices).set({
    subtotal: fromMinor(calculations.subtotalMinor),
    discountTotal: fromMinor(calculations.discountTotalMinor),
    taxTotal: fromMinor(calculations.taxTotalMinor),
    total: fromMinor(calculations.totalMinor),
    updatedAt: new Date(),
    updatedBy: actorId,
  }).where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));
}

async function addDraftItemRows(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  companyId: string,
  invoiceId: string,
  actorId: string,
  items: readonly InvoiceLineInputDTO[],
): Promise<void> {
  const current = await tx.select({ position: invoiceItems.position }).from(invoiceItems)
    .where(and(eq(invoiceItems.invoiceId, invoiceId), eq(invoiceItems.companyId, companyId)))
    .orderBy(asc(invoiceItems.position));
  if (current.length + items.length > 100) throw new DomainError("VALIDATION", "An invoice can have at most 100 lines.");
  const nextPosition = current.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const { rows } = calculateItemRows(companyId, invoiceId, items);
  if (rows.length > 0) await tx.insert(invoiceItems).values(rows.map((row) => ({
    ...row,
    position: row.position + nextPosition,
    createdBy: actorId,
    updatedBy: actorId,
  })));
}

export async function createInvoiceDraft(actor: Actor, input: CreateInvoiceDraftInput): Promise<InvoiceDraftDTO> {
  requirePermission(actor, "finance.invoices.create");
  const parsed = parseInput(createInvoiceDraftSchema, input);
  const normalizedItems = parsed.items.map((item) => parseInput(invoiceLineInputSchema, item));
  const requestHash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");

  return withTransaction(async (tx) => {
    const claim = await beginIdempotentOperation(tx, {
      companyId: actor.companyId,
      key: parsed.idempotencyKey,
      operation: "invoice.createDraft",
      requestHash,
    });

    if (claim.replay) return parseInput(invoiceDraftDtoSchema, claim.response);

    await validateReferences(tx, actor.companyId, parsed.clientId, parsed.projectId);
    const [company] = await tx.select({ currency: companies.currency }).from(companies)
      .where(eq(companies.id, actor.companyId)).limit(1);
    if (!company) throw new DomainError("CONFLICT", "Company settings are unavailable.");

    const [invoice] = await tx.insert(invoices).values({
      companyId: actor.companyId,
      clientId: parsed.clientId,
      projectId: parsed.projectId ?? null,
      dueDate: parsed.dueDate ?? null,
      currency: company.currency,
      status: "draft",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    }).returning();
    if (!invoice) throw new DomainError("CONFLICT", "Invoice draft could not be created.");

    await addDraftItemRows(tx, actor.companyId, invoice.id, actor.userId, normalizedItems);
    await recomputeDraftTotals(tx, actor.companyId, invoice.id, actor.userId);
    const calculated = await loadInvoiceDraft(tx, actor.companyId, invoice.id);
    await completeIdempotentOperation(tx, claim.id, "invoice", invoice.id, calculated);
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoice.id,
      action: "invoice.draft.created",
      after: {
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        status: "draft",
        subtotal: calculated.subtotal,
        discountTotal: calculated.discountTotal,
        taxTotal: calculated.taxTotal,
        total: calculated.total,
      },
    });
    return calculated;
  });
}

export async function updateInvoiceDraft(
  actor: Actor,
  invoiceId: string,
  input: UpdateInvoiceDraftInput,
): Promise<InvoiceDraftDTO> {
  requirePermission(actor, "finance.invoices.update");
  const parsed = parseInput(updateInvoiceDraftSchema, input);
  return withTransaction(async (tx) => {
    const before = await loadInvoiceDraft(tx, actor.companyId, invoiceId, true);
    const projectId = parsed.projectId === undefined ? before.projectId : parsed.projectId;
    const dueDate = parsed.dueDate === undefined ? before.dueDate : parsed.dueDate;
    await validateReferences(tx, actor.companyId, parsed.clientId, projectId);
    await tx.update(invoices).set({
      clientId: parsed.clientId,
      projectId,
      dueDate,
      updatedAt: new Date(),
      updatedBy: actor.userId,
    }).where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, actor.companyId)));
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoiceId,
      action: "invoice.draft.updated",
      before: { clientId: before.clientId, projectId: before.projectId, dueDate: before.dueDate },
      after: { clientId: parsed.clientId, projectId, dueDate },
    });
    return loadInvoiceDraft(tx, actor.companyId, invoiceId);
  });
}

export async function addInvoiceLine(
  actor: Actor,
  invoiceId: string,
  input: InvoiceLineInputDTO,
): Promise<InvoiceDraftDTO> {
  requirePermission(actor, "finance.invoices.update");
  const parsed = parseInput(invoiceLineInputSchema, input);
  return withTransaction(async (tx) => {
    await loadInvoiceDraft(tx, actor.companyId, invoiceId, true);
    await addDraftItemRows(tx, actor.companyId, invoiceId, actor.userId, [parsed]);
    await recomputeDraftTotals(tx, actor.companyId, invoiceId, actor.userId);
    const { rows } = calculateItemRows(actor.companyId, invoiceId, [parsed]);
    const row = rows[0];
    if (!row) throw new DomainError("VALIDATION", "Invoice line is invalid.");
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoiceId,
      action: "invoice.draft.line_added",
      after: { description: row.description, quantity: row.quantity, unitPrice: row.unitPrice, discount: row.discount, taxRate: row.taxRate, lineTotal: row.lineTotal },
    });
    return loadInvoiceDraft(tx, actor.companyId, invoiceId);
  });
}

export async function updateInvoiceLine(
  actor: Actor,
  invoiceId: string,
  input: UpdateInvoiceLineInput,
): Promise<InvoiceDraftDTO> {
  requirePermission(actor, "finance.invoices.update");
  const parsed = parseInput(updateInvoiceLineSchema, input);
  return withTransaction(async (tx) => {
    await loadInvoiceDraft(tx, actor.companyId, invoiceId, true);
    const [item] = await tx.select().from(invoiceItems).where(and(
      eq(invoiceItems.id, parsed.itemId),
      eq(invoiceItems.invoiceId, invoiceId),
      eq(invoiceItems.companyId, actor.companyId),
    )).limit(1);
    if (!item) throw new DomainError("INVOICE_ITEM_NOT_FOUND", "Invoice line was not found.");
    const { rows } = calculateItemRows(actor.companyId, invoiceId, [parsed]);
    const row = rows[0];
    if (!row) throw new DomainError("VALIDATION", "Invoice line is invalid.");
    await tx.update(invoiceItems).set({
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      discount: row.discount,
      taxRate: row.taxRate,
      subtotal: row.subtotal,
      taxAmount: row.taxAmount,
      lineTotal: row.lineTotal,
      position: item.position,
      updatedAt: new Date(),
      updatedBy: actor.userId,
    }).where(and(eq(invoiceItems.id, parsed.itemId), eq(invoiceItems.invoiceId, invoiceId), eq(invoiceItems.companyId, actor.companyId)));
    await recomputeDraftTotals(tx, actor.companyId, invoiceId, actor.userId);
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoiceId,
      action: "invoice.draft.line_updated",
      before: { itemId: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, lineTotal: item.lineTotal },
      after: { itemId: parsed.itemId, description: parsed.description, quantity: row.quantity, unitPrice: row.unitPrice, discount: row.discount, taxRate: row.taxRate, lineTotal: row.lineTotal },
    });
    return loadInvoiceDraft(tx, actor.companyId, invoiceId);
  });
}

export async function removeInvoiceLine(actor: Actor, invoiceId: string, itemId: string): Promise<InvoiceDraftDTO> {
  requirePermission(actor, "finance.invoices.update");
  const parsed = parseInput(removeInvoiceLineSchema, { itemId });
  return withTransaction(async (tx) => {
    await loadInvoiceDraft(tx, actor.companyId, invoiceId, true);
    const [item] = await tx.select().from(invoiceItems).where(and(
      eq(invoiceItems.id, parsed.itemId),
      eq(invoiceItems.invoiceId, invoiceId),
      eq(invoiceItems.companyId, actor.companyId),
    )).limit(1);
    if (!item) throw new DomainError("INVOICE_ITEM_NOT_FOUND", "Invoice line was not found.");
    await tx.delete(invoiceItems).where(and(
      eq(invoiceItems.id, parsed.itemId),
      eq(invoiceItems.invoiceId, invoiceId),
      eq(invoiceItems.companyId, actor.companyId),
    ));
    await recomputeDraftTotals(tx, actor.companyId, invoiceId, actor.userId);
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoiceId,
      action: "invoice.draft.line_removed",
      before: { itemId: item.id, description: item.description, lineTotal: item.lineTotal },
    });
    return loadInvoiceDraft(tx, actor.companyId, invoiceId);
  });
}

export async function issueInvoice(actor: Actor, invoiceId: string): Promise<IssuedInvoiceDTO> {
  requirePermission(actor, "finance.invoices.issue");
  const parsed = parseInput(issueInvoiceSchema, { invoiceId }) satisfies IssueInvoiceInput;
  return withTransaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(and(
      eq(invoices.id, parsed.invoiceId),
      eq(invoices.companyId, actor.companyId),
    )).limit(1).for("update");
    if (!invoice) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");
    if (invoice.status !== "draft") throw new DomainError("CONFLICT", "Only draft invoices can be issued.");
    if (!invoice.dueDate) throw new DomainError("VALIDATION", "A due date is required before issuing an invoice.");

    await validateReferences(tx, actor.companyId, invoice.clientId, invoice.projectId);
    const items = await tx.select().from(invoiceItems).where(and(
      eq(invoiceItems.invoiceId, invoice.id),
      eq(invoiceItems.companyId, actor.companyId),
    )).orderBy(asc(invoiceItems.position));
    if (items.length === 0) throw new DomainError("VALIDATION", "An invoice needs at least one line before it can be issued.");

    let calculations: ReturnType<typeof calcInvoice>;
    try {
      calculations = calcInvoice(items.map((item) => ({
        quantity: item.quantity,
        unitPriceMinor: toMinor(item.unitPrice),
        discountMinor: toMinor(item.discount),
        taxRate: item.taxRate,
      })));
    } catch (error) {
      if (error instanceof Error) throw new DomainError("VALIDATION", error.message);
      throw new DomainError("VALIDATION", "Invoice totals could not be validated.");
    }
    if (calculations.totalMinor <= 0) throw new DomainError("VALIDATION", "An invoice total must be positive before issue.");

    const issueDate = todayInTz(actor.timezone);
    const nextState = transitionInvoiceState(invoice.status, "issued");
    const invoiceNumber = await nextInvoiceNumber(tx, actor.companyId, issueDate);
    const [issued] = await tx.update(invoices).set({
      status: nextState,
      invoiceNumber,
      issueDate,
      subtotal: fromMinor(calculations.subtotalMinor),
      discountTotal: fromMinor(calculations.discountTotalMinor),
      taxTotal: fromMinor(calculations.taxTotalMinor),
      total: fromMinor(calculations.totalMinor),
      updatedAt: new Date(),
      updatedBy: actor.userId,
    }).where(and(
      eq(invoices.id, invoice.id),
      eq(invoices.companyId, actor.companyId),
      eq(invoices.status, "draft"),
    )).returning({ id: invoices.id });
    if (!issued) throw new DomainError("CONFLICT", "Invoice could not be issued.");

    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoice.id,
      action: "invoice.issued",
      before: { status: "draft", total: invoice.total },
      after: {
        status: "issued",
        invoiceNumber,
        issueDate,
        dueDate: invoice.dueDate,
        total: fromMinor(calculations.totalMinor),
      },
    });

    return {
      id: invoice.id,
      clientId: invoice.clientId,
      projectId: invoice.projectId,
      invoiceNumber,
      status: "issued",
      issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      subtotal: fromMinor(calculations.subtotalMinor),
      discountTotal: fromMinor(calculations.discountTotalMinor),
      taxTotal: fromMinor(calculations.taxTotalMinor),
      total: fromMinor(calculations.totalMinor),
      items: items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })),
    };
  });
}

export type CancelledInvoiceDTO = {
  id: string;
  invoiceNumber: string | null;
  status: "cancelled";
  cancelledAt: Date;
  reason: string;
};

export async function cancelInvoice(actor: Actor, input: CancelInvoiceInput): Promise<CancelledInvoiceDTO> {
  requirePermission(actor, "finance.invoices.cancel");
  const parsed = parseInput(cancelInvoiceSchema, input);
  return withTransaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(and(
      eq(invoices.id, parsed.invoiceId),
      eq(invoices.companyId, actor.companyId),
    )).limit(1).for("update");
    if (!invoice) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");
    if (invoice.status !== "draft" && invoice.status !== "issued") {
      throw new DomainError("CONFLICT", "Only draft or issued invoices can be cancelled.");
    }

    const [unresolvedReceipt] = await tx.select({ id: payments.id }).from(paymentAllocations)
      .innerJoin(payments, and(
        eq(payments.id, paymentAllocations.paymentId),
        eq(payments.companyId, paymentAllocations.companyId),
      )).where(and(
        eq(paymentAllocations.companyId, actor.companyId),
        eq(paymentAllocations.invoiceId, invoice.id),
        inArray(payments.status, ["pending", "confirmed"]),
      )).limit(1);
    if (unresolvedReceipt) {
      throw new DomainError("CONFLICT", "Resolve pending receipts and reverse confirmed receipts before cancelling this invoice.");
    }

    const nextStatus = transitionInvoiceState(invoice.status, "cancelled");
    const now = new Date();
    const [cancelled] = await tx.update(invoices).set({
      status: nextStatus,
      cancelledAt: now,
      cancelReason: parsed.reason,
      updatedAt: now,
      updatedBy: actor.userId,
    }).where(and(
      eq(invoices.id, invoice.id),
      eq(invoices.companyId, actor.companyId),
      inArray(invoices.status, ["draft", "issued"]),
    )).returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });
    if (!cancelled) throw new DomainError("CONFLICT", "Invoice could not be cancelled.");
    await audit.record(tx, {
      actor,
      entity: "invoice",
      entityId: invoice.id,
      action: "invoice.cancelled",
      before: { status: invoice.status, total: invoice.total },
      after: { status: "cancelled", reason: parsed.reason },
    });
    return {
      id: invoice.id,
      invoiceNumber: cancelled.invoiceNumber,
      status: "cancelled",
      cancelledAt: now,
      reason: parsed.reason,
    };
  });
}
