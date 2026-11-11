import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { clients, invoices, paymentAllocations, payments } from "@/db/schema";

export type ClientFinanceSummary = {
  clientId: string;
  outstandingByCurrency: Array<{ currency: string; amount: string }>;
};

/** Return issued-invoice receivables, grouped so currencies are never combined. */
export async function getClientFinanceSummary(
  actor: Actor,
  clientId: string,
): Promise<ClientFinanceSummary> {
  requirePermission(actor, "finance.invoices.read");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    throw new DomainError("VALIDATION", "Client ID is invalid.");
  }

  const [client] = await db.select({ id: clients.id }).from(clients).where(and(
    eq(clients.id, clientId),
    eq(clients.companyId, actor.companyId),
  )).limit(1);
  if (!client) throw new DomainError("CLIENT_NOT_FOUND", "Client was not found.");

  const confirmedAmount = sql<string>`COALESCE(SUM(CASE WHEN ${payments.id} IS NOT NULL THEN ${paymentAllocations.amount}::numeric ELSE 0 END), 0)::numeric`;
  const invoiceBalances = db.select({
    invoiceId: invoices.id,
    currency: invoices.currency,
    outstanding: sql<string>`GREATEST(${invoices.total}::numeric - ${confirmedAmount}, 0)::numeric`,
  }).from(invoices)
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
    .where(and(
      eq(invoices.companyId, actor.companyId),
      eq(invoices.clientId, clientId),
      eq(invoices.status, "issued"),
    ))
    .groupBy(invoices.id, invoices.currency, invoices.total)
    .as("client_invoice_balances");

  const rows = await db.select({
    currency: invoiceBalances.currency,
    amount: sql<string>`COALESCE(SUM(${invoiceBalances.outstanding}::numeric), 0)::numeric`,
  }).from(invoiceBalances).groupBy(invoiceBalances.currency).orderBy(invoiceBalances.currency);

  return {
    clientId,
    outstandingByCurrency: rows.map((row) => ({
      currency: row.currency,
      amount: fromMinor(toMinor(row.amount)),
    })),
  };
}
