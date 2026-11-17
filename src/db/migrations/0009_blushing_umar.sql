CREATE TABLE "project_client_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_client_items_title_chk" CHECK (length(btrim(title)) > 0)
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_comments_body_chk" CHECK (length(btrim(body)) > 0)
);
--> statement-breakpoint
ALTER TABLE "project_client_items" ADD CONSTRAINT "project_client_items_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_client_items_project_idx" ON "project_client_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_comments_project_idx" ON "project_comments" USING btree ("project_id","created_at");