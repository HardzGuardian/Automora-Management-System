import "server-only";
import { and, eq } from "drizzle-orm";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { db } from "@/db";
import { clients, companies, invoices } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { formatMoney, toMinor } from "@/lib/money";
import { getInvoiceDetail, type InvoiceDetailDTO } from "./queries";

export type InvoicePdfData = {
  invoice: InvoiceDetailDTO;
  company: { name: string; legalName: string | null; email: string | null; phone: string | null; address: string | null };
  client: { name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null };
};

export async function getInvoicePdfData(actor: Actor, invoiceId: string): Promise<InvoicePdfData> {
  requirePermission(actor, "finance.invoices.read");
  const [parties] = await db.select({
    companyName: companies.displayName,
    companyLegalName: companies.legalName,
    companyEmail: companies.email,
    companyPhone: companies.phone,
    companyAddress: companies.address,
    clientName: clients.name,
    clientContactPerson: clients.contactPerson,
    clientEmail: clients.email,
    clientPhone: clients.phone,
    clientAddress: clients.address,
  }).from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .innerJoin(clients, and(
      eq(clients.id, invoices.clientId),
      eq(clients.companyId, invoices.companyId),
    ))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, actor.companyId)))
    .limit(1);
  if (!parties) throw new DomainError("INVOICE_NOT_FOUND", "Invoice was not found.");
  const invoice = await getInvoiceDetail(actor, invoiceId);
  return {
    invoice,
    company: {
      name: parties.companyName,
      legalName: parties.companyLegalName,
      email: parties.companyEmail,
      phone: parties.companyPhone,
      address: parties.companyAddress,
    },
    client: {
      name: parties.clientName,
      contactPerson: parties.clientContactPerson,
      email: parties.clientEmail,
      phone: parties.clientPhone,
      address: parties.clientAddress,
    },
  };
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#172033", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 14 },
  heading: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  muted: { color: "#5f6b7a", marginBottom: 3 },
  section: { marginBottom: 18 },
  tableHeader: { flexDirection: "row", backgroundColor: "#edf1f5", padding: 7, fontWeight: 700 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d9dee7", padding: 7 },
  description: { width: "46%" },
  quantity: { width: "14%", textAlign: "right" },
  unit: { width: "20%", textAlign: "right" },
  amount: { width: "20%", textAlign: "right" },
  totals: { width: "42%", alignSelf: "flex-end", marginTop: 12 },
  total: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  grandTotal: { borderTopWidth: 1, borderTopColor: "#172033", paddingTop: 6, fontWeight: 700 },
});

function displayAddress(value: string | null): string | null {
  return value?.trim() || null;
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const { invoice, company, client } = data;
  const money = (value: string) => formatMoney(toMinor(value), invoice.currency);
  const companyAddress = displayAddress(company.address);
  const clientAddress = displayAddress(client.address);
  return (
    <Document title={`Invoice ${invoice.invoiceNumber ?? "Draft"}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.title}>{company.name}</Text>
            {company.legalName && <Text style={styles.muted}>{company.legalName}</Text>}
            {companyAddress && <Text style={styles.muted}>{companyAddress}</Text>}
            {company.email && <Text style={styles.muted}>{company.email}</Text>}
            {company.phone && <Text style={styles.muted}>{company.phone}</Text>}
          </View>
          <View>
            <Text style={styles.heading}>INVOICE</Text>
            <Text style={styles.muted}>Number: {invoice.invoiceNumber ?? "Draft"}</Text>
            <Text style={styles.muted}>Status: {invoice.status.replaceAll("_", " ")}</Text>
            <Text style={styles.muted}>Issue date: {invoice.issueDate ?? "—"}</Text>
            <Text style={styles.muted}>Due date: {invoice.dueDate ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Bill to</Text>
          <Text>{client.name}</Text>
          {client.contactPerson && <Text style={styles.muted}>{client.contactPerson}</Text>}
          {clientAddress && <Text style={styles.muted}>{clientAddress}</Text>}
          {client.email && <Text style={styles.muted}>{client.email}</Text>}
          {client.phone && <Text style={styles.muted}>{client.phone}</Text>}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.description}>Description</Text>
          <Text style={styles.quantity}>Qty</Text>
          <Text style={styles.unit}>Unit price</Text>
          <Text style={styles.amount}>Line total</Text>
        </View>
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.quantity}>{item.quantity}</Text>
            <Text style={styles.unit}>{money(item.unitPrice)}</Text>
            <Text style={styles.amount}>{money(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.total}><Text>Subtotal</Text><Text>{money(invoice.subtotal)}</Text></View>
          <View style={styles.total}><Text>Discount</Text><Text>-{money(invoice.discountTotal)}</Text></View>
          <View style={styles.total}><Text>Tax</Text><Text>{money(invoice.taxTotal)}</Text></View>
          <View style={[styles.total, styles.grandTotal]}><Text>Total</Text><Text>{money(invoice.total)}</Text></View>
          <View style={styles.total}><Text>Confirmed receipts</Text><Text>{money(invoice.confirmedReceipts)}</Text></View>
          <View style={styles.total}><Text>Balance due</Text><Text>{money(invoice.outstanding)}</Text></View>
        </View>
      </Page>
    </Document>
  );
}
