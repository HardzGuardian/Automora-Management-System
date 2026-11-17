CREATE TYPE "public"."expense_status" AS ENUM('unpaid', 'partially_paid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."finance_payment_method" AS ENUM('bank_transfer', 'upi', 'cash', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."finance_payment_status" AS ENUM('pending', 'confirmed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."invoice_lifecycle" AS ENUM('draft', 'issued', 'cancelled');--> statement-breakpoint
CREATE TABLE "expense_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "expense_attachments_expense_file_unique" UNIQUE("expense_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "expense_categories_id_company_unique" UNIQUE("id","company_id")
);
--> statement-breakpoint
CREATE TABLE "expense_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"method" "finance_payment_method" NOT NULL,
	"reference" text,
	"notes" text,
	"status" "finance_payment_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"reversed_at" timestamp with time zone,
	"reversed_by" text,
	"reverse_reason" text,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "expense_payments_id_company_unique" UNIQUE("id","company_id"),
	CONSTRAINT "expense_payments_amount_positive" CHECK ("expense_payments"."amount" > 0),
	CONSTRAINT "expense_payments_reference_required_for_non_cash" CHECK ("expense_payments"."method" = 'cash' OR "expense_payments"."reference" IS NOT NULL),
	CONSTRAINT "expense_payments_confirmation_metadata" CHECK ("expense_payments"."status" <> 'confirmed' OR ("expense_payments"."confirmed_at" IS NOT NULL AND "expense_payments"."confirmed_by" IS NOT NULL)),
	CONSTRAINT "expense_payments_reversal_metadata" CHECK ("expense_payments"."status" <> 'reversed' OR ("expense_payments"."reversed_at" IS NOT NULL AND "expense_payments"."reversed_by" IS NOT NULL AND "expense_payments"."reverse_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"project_id" uuid,
	"expense_code" text NOT NULL,
	"payee" text NOT NULL,
	"description" text NOT NULL,
	"expense_date" date NOT NULL,
	"due_date" date,
	"total" numeric(14, 2) NOT NULL,
	"status" "expense_status" DEFAULT 'unpaid' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "expenses_id_company_unique" UNIQUE("id","company_id"),
	CONSTRAINT "expenses_total_positive" CHECK ("expenses"."total" > 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "invoice_items_id_company_unique" UNIQUE("id","company_id"),
	CONSTRAINT "invoice_items_quantity_positive" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_unit_price_positive" CHECK ("invoice_items"."unit_price" > 0),
	CONSTRAINT "invoice_items_discount_nonnegative" CHECK ("invoice_items"."discount" >= 0),
	CONSTRAINT "invoice_items_discount_within_subtotal" CHECK ("invoice_items"."discount" <= "invoice_items"."subtotal"),
	CONSTRAINT "invoice_items_tax_rate_nonnegative" CHECK ("invoice_items"."tax_rate" >= 0),
	CONSTRAINT "invoice_items_subtotal_nonnegative" CHECK ("invoice_items"."subtotal" >= 0),
	CONSTRAINT "invoice_items_tax_nonnegative" CHECK ("invoice_items"."tax_amount" >= 0),
	CONSTRAINT "invoice_items_total_nonnegative" CHECK ("invoice_items"."line_total" >= 0),
	CONSTRAINT "invoice_items_total_reconciles" CHECK ("invoice_items"."line_total" = "invoice_items"."subtotal" - "invoice_items"."discount" + "invoice_items"."tax_amount")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"invoice_number" text,
	"status" "invoice_lifecycle" DEFAULT 'draft' NOT NULL,
	"issue_date" date,
	"due_date" date,
	"currency" text NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "invoices_id_company_unique" UNIQUE("id","company_id"),
	CONSTRAINT "invoices_subtotal_nonnegative" CHECK ("invoices"."subtotal" >= 0),
	CONSTRAINT "invoices_discount_nonnegative" CHECK ("invoices"."discount_total" >= 0),
	CONSTRAINT "invoices_tax_nonnegative" CHECK ("invoices"."tax_total" >= 0),
	CONSTRAINT "invoices_total_nonnegative" CHECK ("invoices"."total" >= 0),
	CONSTRAINT "invoices_total_reconciles" CHECK ("invoices"."total" = "invoices"."subtotal" - "invoices"."discount_total" + "invoices"."tax_total"),
	CONSTRAINT "invoices_issued_fields_required" CHECK ("invoices"."status" <> 'issued' OR ("invoices"."invoice_number" IS NOT NULL AND "invoices"."issue_date" IS NOT NULL AND "invoices"."due_date" IS NOT NULL)),
	CONSTRAINT "invoices_cancel_reason_required" CHECK ("invoices"."status" <> 'cancelled' OR ("invoices"."cancelled_at" IS NOT NULL AND "invoices"."cancel_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"method" "finance_payment_method" NOT NULL,
	"reference" text,
	"notes" text,
	"status" "finance_payment_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"reversed_at" timestamp with time zone,
	"reversed_by" text,
	"reverse_reason" text,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "payments_id_company_unique" UNIQUE("id","company_id"),
	CONSTRAINT "payments_id_company_invoice_unique" UNIQUE("id","company_id","invoice_id"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_reference_required_for_non_cash" CHECK ("payments"."method" = 'cash' OR "payments"."reference" IS NOT NULL),
	CONSTRAINT "payments_confirmation_metadata" CHECK ("payments"."status" <> 'confirmed' OR ("payments"."confirmed_at" IS NOT NULL AND "payments"."confirmed_by" IS NOT NULL)),
	CONSTRAINT "payments_reversal_metadata" CHECK ("payments"."status" <> 'reversed' OR ("payments"."reversed_at" IS NOT NULL AND "payments"."reversed_by" IS NOT NULL AND "payments"."reverse_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expense_company_fk" FOREIGN KEY ("expense_id","company_id") REFERENCES "public"."expenses"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_file_company_fk" FOREIGN KEY ("file_id","company_id") REFERENCES "public"."files"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_expense_company_fk" FOREIGN KEY ("expense_id","company_id") REFERENCES "public"."expenses"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_company_fk" FOREIGN KEY ("category_id","company_id") REFERENCES "public"."expense_categories"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_company_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_company_fk" FOREIGN KEY ("invoice_id","company_id") REFERENCES "public"."invoices"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_company_fk" FOREIGN KEY ("client_id","company_id") REFERENCES "public"."clients"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_company_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_invoice_company_fk" FOREIGN KEY ("payment_id","company_id","invoice_id") REFERENCES "public"."payments"("id","company_id","invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_company_fk" FOREIGN KEY ("invoice_id","company_id") REFERENCES "public"."invoices"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_company_fk" FOREIGN KEY ("invoice_id","company_id") REFERENCES "public"."invoices"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_attachments_company_expense_idx" ON "expense_attachments" USING btree ("company_id","expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_company_name_unique" ON "expense_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "expense_categories_company_active_idx" ON "expense_categories" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "expense_payments_company_status_idx" ON "expense_payments" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "expense_payments_expense_idx" ON "expense_payments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_payments_company_date_idx" ON "expense_payments" USING btree ("company_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_company_code_unique" ON "expenses" USING btree ("company_id","expense_code");--> statement-breakpoint
CREATE INDEX "expenses_company_status_idx" ON "expenses" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "expenses_company_archive_date_idx" ON "expenses" USING btree ("company_id","archived_at","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_company_due_date_idx" ON "expenses" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "expenses_project_idx" ON "expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_company_key_unique" ON "idempotency_keys" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_company_created_idx" ON "idempotency_keys" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_items_company_invoice_idx" ON "invoice_items" USING btree ("company_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_company_number_unique" ON "invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_company_status_idx" ON "invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "invoices_company_issue_date_idx" ON "invoices" USING btree ("company_id","issue_date");--> statement-breakpoint
CREATE INDEX "invoices_company_status_issue_date_idx" ON "invoices" USING btree ("company_id","status","issue_date");--> statement-breakpoint
CREATE INDEX "invoices_company_due_date_idx" ON "invoices" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_project_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_company_invoice_idx" ON "payment_allocations" USING btree ("company_id","invoice_id");--> statement-breakpoint
CREATE INDEX "payments_company_status_idx" ON "payments" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_company_date_idx" ON "payments" USING btree ("company_id","payment_date");