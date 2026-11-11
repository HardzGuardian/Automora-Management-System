import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./company";
import { clients } from "./clients";
import { files } from "./files";
import { projects } from "./projects";
import { user } from "./auth";

export const invoiceLifecycleEnum = pgEnum("invoice_lifecycle", ["draft", "issued", "cancelled"]);
export const financePaymentStatusEnum = pgEnum("finance_payment_status", ["pending", "confirmed", "reversed"]);
export const expenseStatusEnum = pgEnum("expense_status", ["unpaid", "partially_paid", "paid"]);
export const financePaymentMethodEnum = pgEnum("finance_payment_method", ["bank_transfer", "upi", "cash", "card", "other"]);

function auditColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
  };
}

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  clientId: uuid("client_id").notNull(),
  projectId: uuid("project_id"),
  invoiceNumber: text("invoice_number"),
  status: invoiceLifecycleEnum("status").notNull().default("draft"),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  currency: text("currency").notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
  taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...auditColumns(),
}, (table) => [
  unique("invoices_id_company_unique").on(table.id, table.companyId),
  uniqueIndex("invoices_company_number_unique").on(table.companyId, table.invoiceNumber),
  foreignKey({ columns: [table.clientId, table.companyId], foreignColumns: [clients.id, clients.companyId], name: "invoices_client_company_fk" }),
  foreignKey({ columns: [table.projectId, table.companyId], foreignColumns: [projects.id, projects.companyId], name: "invoices_project_company_fk" }),
  check("invoices_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
  check("invoices_discount_nonnegative", sql`${table.discountTotal} >= 0`),
  check("invoices_tax_nonnegative", sql`${table.taxTotal} >= 0`),
  check("invoices_total_nonnegative", sql`${table.total} >= 0`),
  check("invoices_total_reconciles", sql`${table.total} = ${table.subtotal} - ${table.discountTotal} + ${table.taxTotal}`),
  check("invoices_issued_fields_required", sql`${table.status} <> 'issued' OR (${table.invoiceNumber} IS NOT NULL AND ${table.issueDate} IS NOT NULL AND ${table.dueDate} IS NOT NULL)`),
  check("invoices_cancel_reason_required", sql`${table.status} <> 'cancelled' OR (${table.cancelledAt} IS NOT NULL AND ${table.cancelReason} IS NOT NULL)`),
  index("invoices_company_status_idx").on(table.companyId, table.status),
  index("invoices_company_issue_date_idx").on(table.companyId, table.issueDate),
  index("invoices_company_status_issue_date_idx").on(table.companyId, table.status, table.issueDate),
  index("invoices_company_due_date_idx").on(table.companyId, table.dueDate),
  index("invoices_client_idx").on(table.clientId),
  index("invoices_project_idx").on(table.projectId),
]);

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  invoiceId: uuid("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
  ...auditColumns(),
}, (table) => [
  unique("invoice_items_id_company_unique").on(table.id, table.companyId),
  foreignKey({ columns: [table.invoiceId, table.companyId], foreignColumns: [invoices.id, invoices.companyId], name: "invoice_items_invoice_company_fk" }),
  check("invoice_items_quantity_positive", sql`${table.quantity} > 0`),
  check("invoice_items_unit_price_positive", sql`${table.unitPrice} > 0`),
  check("invoice_items_discount_nonnegative", sql`${table.discount} >= 0`),
  check("invoice_items_discount_within_subtotal", sql`${table.discount} <= ${table.subtotal}`),
  check("invoice_items_tax_rate_nonnegative", sql`${table.taxRate} >= 0`),
  check("invoice_items_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
  check("invoice_items_tax_nonnegative", sql`${table.taxAmount} >= 0`),
  check("invoice_items_total_nonnegative", sql`${table.lineTotal} >= 0`),
  check("invoice_items_total_reconciles", sql`${table.lineTotal} = ${table.subtotal} - ${table.discount} + ${table.taxAmount}`),
  index("invoice_items_company_invoice_idx").on(table.companyId, table.invoiceId),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  invoiceId: uuid("invoice_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: financePaymentMethodEnum("method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  status: financePaymentStatusEnum("status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: uuid("confirmed_by").references(() => user.id),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by").references(() => user.id),
  reverseReason: text("reverse_reason"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  ...auditColumns(),
}, (table) => [
  unique("payments_id_company_unique").on(table.id, table.companyId),
  unique("payments_id_company_invoice_unique").on(table.id, table.companyId, table.invoiceId),
  foreignKey({ columns: [table.invoiceId, table.companyId], foreignColumns: [invoices.id, invoices.companyId], name: "payments_invoice_company_fk" }),
  check("payments_amount_positive", sql`${table.amount} > 0`),
  check("payments_reference_required_for_non_cash", sql`${table.method} = 'cash' OR ${table.reference} IS NOT NULL`),
  check("payments_confirmation_metadata", sql`${table.status} <> 'confirmed' OR (${table.confirmedAt} IS NOT NULL AND ${table.confirmedBy} IS NOT NULL)`),
  check("payments_reversal_metadata", sql`${table.status} <> 'reversed' OR (${table.reversedAt} IS NOT NULL AND ${table.reversedBy} IS NOT NULL AND ${table.reverseReason} IS NOT NULL)`),
  index("payments_company_status_idx").on(table.companyId, table.status),
  index("payments_invoice_idx").on(table.invoiceId),
  index("payments_company_date_idx").on(table.companyId, table.paymentDate),
]);

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  paymentId: uuid("payment_id").notNull(),
  invoiceId: uuid("invoice_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => user.id),
}, (table) => [
  foreignKey({ columns: [table.paymentId, table.companyId, table.invoiceId], foreignColumns: [payments.id, payments.companyId, payments.invoiceId], name: "payment_allocations_payment_invoice_company_fk" }),
  foreignKey({ columns: [table.invoiceId, table.companyId], foreignColumns: [invoices.id, invoices.companyId], name: "payment_allocations_invoice_company_fk" }),
  check("payment_allocations_amount_positive", sql`${table.amount} > 0`),
  index("payment_allocations_company_invoice_idx").on(table.companyId, table.invoiceId),
]);

export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  ...auditColumns(),
}, (table) => [
  unique("expense_categories_id_company_unique").on(table.id, table.companyId),
  uniqueIndex("expense_categories_company_name_unique").on(table.companyId, table.name),
  index("expense_categories_company_active_idx").on(table.companyId, table.active),
]);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  categoryId: uuid("category_id").notNull(),
  projectId: uuid("project_id"),
  expenseCode: text("expense_code").notNull(),
  payee: text("payee").notNull(),
  description: text("description").notNull(),
  expenseDate: date("expense_date").notNull(),
  dueDate: date("due_date"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  status: expenseStatusEnum("status").notNull().default("unpaid"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...auditColumns(),
}, (table) => [
  unique("expenses_id_company_unique").on(table.id, table.companyId),
  uniqueIndex("expenses_company_code_unique").on(table.companyId, table.expenseCode),
  foreignKey({ columns: [table.categoryId, table.companyId], foreignColumns: [expenseCategories.id, expenseCategories.companyId], name: "expenses_category_company_fk" }),
  foreignKey({ columns: [table.projectId, table.companyId], foreignColumns: [projects.id, projects.companyId], name: "expenses_project_company_fk" }),
  check("expenses_total_positive", sql`${table.total} > 0`),
  index("expenses_company_status_idx").on(table.companyId, table.status),
  index("expenses_company_archive_date_idx").on(table.companyId, table.archivedAt, table.expenseDate),
  index("expenses_company_due_date_idx").on(table.companyId, table.dueDate),
  index("expenses_project_idx").on(table.projectId),
  index("expenses_category_idx").on(table.categoryId),
]);

export const expensePayments = pgTable("expense_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  expenseId: uuid("expense_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: financePaymentMethodEnum("method").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  status: financePaymentStatusEnum("status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: uuid("confirmed_by").references(() => user.id),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by").references(() => user.id),
  reverseReason: text("reverse_reason"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  ...auditColumns(),
}, (table) => [
  unique("expense_payments_id_company_unique").on(table.id, table.companyId),
  foreignKey({ columns: [table.expenseId, table.companyId], foreignColumns: [expenses.id, expenses.companyId], name: "expense_payments_expense_company_fk" }),
  check("expense_payments_amount_positive", sql`${table.amount} > 0`),
  check("expense_payments_reference_required_for_non_cash", sql`${table.method} = 'cash' OR ${table.reference} IS NOT NULL`),
  check("expense_payments_confirmation_metadata", sql`${table.status} <> 'confirmed' OR (${table.confirmedAt} IS NOT NULL AND ${table.confirmedBy} IS NOT NULL)`),
  check("expense_payments_reversal_metadata", sql`${table.status} <> 'reversed' OR (${table.reversedAt} IS NOT NULL AND ${table.reversedBy} IS NOT NULL AND ${table.reverseReason} IS NOT NULL)`),
  index("expense_payments_company_status_idx").on(table.companyId, table.status),
  index("expense_payments_expense_idx").on(table.expenseId),
  index("expense_payments_company_date_idx").on(table.companyId, table.paymentDate),
]);

export const expenseAttachments = pgTable("expense_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  expenseId: uuid("expense_id").notNull(),
  fileId: uuid("file_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => user.id),
}, (table) => [
  foreignKey({ columns: [table.expenseId, table.companyId], foreignColumns: [expenses.id, expenses.companyId], name: "expense_attachments_expense_company_fk" }),
  foreignKey({ columns: [table.fileId, table.companyId], foreignColumns: [files.id, files.companyId], name: "expense_attachments_file_company_fk" }),
  unique("expense_attachments_expense_file_unique").on(table.expenseId, table.fileId),
  index("expense_attachments_company_expense_idx").on(table.companyId, table.expenseId),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  idempotencyKey: uuid("idempotency_key").notNull(),
  operation: text("operation").notNull(),
  requestHash: text("request_hash").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idempotency_keys_company_key_unique").on(table.companyId, table.idempotencyKey),
  index("idempotency_keys_company_created_idx").on(table.companyId, table.createdAt),
]);
