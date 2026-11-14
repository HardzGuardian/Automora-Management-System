CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_documents_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_file_id_company_id_files_id_company_id_fk" FOREIGN KEY ("file_id","company_id") REFERENCES "public"."files"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_documents_project_idx" ON "project_documents" USING btree ("project_id");