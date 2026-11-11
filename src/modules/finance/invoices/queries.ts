import "server-only";
import { and, asc, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { todayInTz } from "@/lib/dates";
import { fromMinor, toMinor } from "@/lib/money";
import { calcOutstanding, deriveInvoiceStatus } from "./balance";
import { invoiceListSchema, type InvoiceListInput, type InvoiceListQueryInput } from "./schemas";
import { clients, invoiceItems, invoices, paymentAllocations, payments } from "@/db/schema";

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string | null;
  clientId: string;
  clientName: string;
  projectId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  total: string;
  confirmedReceipts: string;
  outstanding: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
};

export type InvoiceListDTO = { rows: InvoiceListRow[]; total: number; page: number; pageSize: number };

const confirmedAllocationTotal = sql<string>`COALESCE(SUM(CASE WHEN ${payments.id} IS NOT NULL THEN ${paymentAllocations.amount}::numeric ELSE 0 END), 0)::numeric`;
const outstandingTotal = sql<string>`GREATEST(${invoices.total}::numeric - ${confirmedAllocationTotal}, 0)::numeric`;

function parseInput(input: InvoiceListQueryInput): InvoiceListInput {
  const parsed = invoiceListSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION", "Invoice filters are invalid.", parsed.error.flatten());
  return parsed.data;
}

function baseQuery(actor: Actor, filters: InvoiceListInput, today: string) {
  const where = [eq(invoices.companyId, actor.companyId)];
  if (filters.clientId) where.push(eq(invoices.clientId, filters.clientId));
  if (filters.projectId) where.push(eq(invoices.projectId, filters.projectId));
  if (filters.fromDate) where.push(gte(invoices.issueDate, filters.fromDate));
  if (filters.toDate) where.push(lte(invoices.issueDate, filters.toDate));

  const aggregate = db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    clientId: invoices.clientId,
    clientName: clients.name,
    projectId: invoices.projectId,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    currency: invoices.currency,
    total: invoices.total,
    state: invoices.status,
    confirmedReceipts: confirmedAllocationTotal,
    outstanding: outstandingTotal,
  }).from(invoices)
    .innerJoin(clients, and(eq(clients.id, invoices.clientId), eq(clients.companyId, invoices.companyId)))
    .leftJoin(paymentAllocations, and(
      eq(paymentAllocations.invoiceId, invoices.id),
      eq(paymentAllocations.companyId, invoices.companyId),
    ))
    .leftJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, invoices.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
    ))
    .where(and(...where))
    .groupBy(
      invoices.id,
      invoices.companyId,
      invoices.invoiceNumber,
      invoices.clientId,
      clients.name,
      invoices.projectId,
      invoices.issueDate,
      invoices.dueDate,
      invoices.currency,
      invoices.total,
      invoices.status,
    ).as("invoice_aggregate");

  return db.select({
    id: aggregate.id,
    invoiceNumber: aggregate.invoiceNumber,
    clientId: aggregate.clientId,
    clientName: aggregate.clientName,
    projectId: aggregate.projectId,
    issueDate: aggregate.issueDate,
    dueDate: aggregate.dueDate,
    currency: aggregate.currency,
    total: aggregate.total,
    confirmedReceipts: aggregate.confirmedReceipts,
    outstanding: aggregate.outstanding,
    status: sql<InvoiceListRow["status"]>`CASE
      WHEN ${aggregate.state} = 'draft' THEN 'draft'
      WHEN ${aggregate.state} = 'cancelled' THEN 'cancelled'
      WHEN ${aggregate.outstanding} <= 0 THEN 'paid'
      WHEN ${aggregate.dueDate} < ${today} THEN 'overdue'
      WHEN ${aggregate.confirmedReceipts} > 0 THEN 'partially_paid'
      ELSE 'issued'
    END`.as("status"),
  }).from(aggregate).as("invoice_list");
}

export async function listInvoices(actor: Actor, input: InvoiceListQueryInput): Promise<InvoiceListDTO> {
  requirePermission(actor, "finance.invoices.read");
  const filters = parseInput(input);
  const base = baseQuery(actor, filters, todayInTz(actor.timezone));
  const where = filters.status ? eq(base.status, filters.status) : undefined;
  const [countRow] = await db.select({ value: count() }).from(base).where(where);
  const sortColumn = {
    issueDate: base.issueDate,
    dueDate: base.dueDate,
    total: base.total,
    invoiceNumber: base.invoiceNumber,
  }[filters.sortBy];
  const orderBy = filters.sortDirection === "asc"
    ? [asc(sortColumn), asc(base.id)]
    : [desc(sortColumn), desc(base.id)];
  const rows = await db.select().from(base).where(where).orderBy(...orderBy)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return {
    rows: rows.map((row) => ({
      ...row,
      confirmedReceipts: fromMinor(toMinor(row.confirmedReceipts)),
      outstanding: fromMinor(toMinor(row.outstanding)),
    })),
    total: countRow?.value ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export type InvoiceDetailDTO = InvoiceListRow & {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    taxRate: string;
    lineTotal: string;
  }>;
};

export async function getInvoiceDetail(actor: Actor, invoiceId: string): Promise<InvoiceDetailDTO> {
  requirePermission(actor, "finance.invoices.read");
  const [invoice] = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    clientId: invoices.clientId,
    clientName: clients.name,
    projectId: invoices.projectId,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    currency: invoices.currency,
    subtotal: invoices.subtotal,
    discountTotal: invoices.discountTotal,
    taxTotal: invoices.taxTotal,
    total: invoices.total,
    state: invoices.status,
    confirmedReceipts: confirmedAllocationTotal,
  }).from(invoices)
    .innerJoin(clients, and(eq(clients.id, invoices.clientId), eq(clients.companyId, invoices.companyId)))
    .leftJoin(paymentAllocations, and(
      eq(paymentAllocations.invoiceId, invoices.id),
      eq(paymentAllocations.companyId, invoices.companyId),
    ))
    .leftJoin(payments, and(
      eq(payments.id, paymentAllocations.paymentId),
      eq(payments.companyId, invoices.companyId),
      eq(payments.status, "confirmed"),
      isNull(payments.reversedAt),
    ))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, actor.companyId)))
    .groupBy(
      invoices.id,
      invoices.companyId,
      invoices.invoiceNumber,
      invoices.clientId,
      clients.name,
      invoices.projectId,
      invoices.issueDate,
      invoices.dueDate,
      invoices.currency,
      invoices.subtotal,
      invoices.discountTotal,
      invoices.taxTotal,
      invoices.total,
      invoices.status,
    )
    .limit(1);
  if (!invoice) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");

  const outstandingMinor = calcOutstanding(toMinor(invoice.total), toMinor(invoice.confirmedReceipts));
  const status = deriveInvoiceStatus({
    state: invoice.state,
    totalMinor: toMinor(invoice.total),
    confirmedReceiptsMinor: toMinor(invoice.confirmedReceipts),
    dueDate: invoice.dueDate ?? "9999-12-31",
    today: todayInTz(actor.timezone),
  });
  const items = await db.select({
    id: invoiceItems.id,
    description: invoiceItems.description,
    quantity: invoiceItems.quantity,
    unitPrice: invoiceItems.unitPrice,
    discount: invoiceItems.discount,
    taxRate: invoiceItems.taxRate,
    lineTotal: invoiceItems.lineTotal,
  }).from(invoiceItems).where(and(
    eq(invoiceItems.invoiceId, invoiceId),
    eq(invoiceItems.companyId, actor.companyId),
  )).orderBy(asc(invoiceItems.position));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    projectId: invoice.projectId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    total: invoice.total,
    confirmedReceipts: fromMinor(toMinor(invoice.confirmedReceipts)),
    outstanding: fromMinor(outstandingMinor),
    status,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    items,
  };
}

export async function listInvoiceClients(actor: Actor): Promise<Array<{ id: string; name: string }>> {
  requirePermission(actor, "finance.invoices.create");
  return db.select({ id: clients.id, name: clients.name }).from(clients)
    .where(eq(clients.companyId, actor.companyId))
    .orderBy(asc(clients.name), asc(clients.id));
}
