CREATE TABLE "code_sequences" (
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "code_sequences_company_id_kind_pk" PRIMARY KEY("company_id","kind")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_company_id_setting_key_unique" UNIQUE("company_id","setting_key")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"employee_id" uuid,
	"role_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"group_name" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "roles_company_id_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_code" text NOT NULL,
	"full_name" text NOT NULL,
	"work_email" text NOT NULL,
	"phone" text,
	"designation" text,
	"department" text,
	"joining_date" date,
	"profile_image_file_id" uuid,
	"employment_status" text DEFAULT 'Active' NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "employees_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "employees_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "employees_company_id_employee_code_unique" UNIQUE("company_id","employee_code"),
	CONSTRAINT "employees_company_id_work_email_unique" UNIQUE("company_id","work_email"),
	CONSTRAINT "employees_status_chk" CHECK (employment_status IN ('Active', 'Inactive', 'Suspended'))
);
--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_code" text NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"service_type" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "clients_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "clients_company_id_client_code_unique" UNIQUE("company_id","client_code"),
	CONSTRAINT "clients_status_chk" CHECK (status IN ('Active', 'Inactive'))
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"membership_role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_employee_id_pk" PRIMARY KEY("project_id","employee_id"),
	CONSTRAINT "project_members_role_chk" CHECK (membership_role IN ('owner', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'Pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_status_chk" CHECK (status IN ('Pending', 'In Progress', 'Completed'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"client_id" uuid,
	"owner_employee_id" uuid NOT NULL,
	"start_date" date,
	"due_date" date,
	"status" text DEFAULT 'Planning' NOT NULL,
	"budget_amount" numeric(14, 2),
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "projects_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "projects_company_id_project_code_unique" UNIQUE("company_id","project_code"),
	CONSTRAINT "projects_type_chk" CHECK (type IN ('Client', 'Internal')),
	CONSTRAINT "projects_status_chk" CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled', 'Archived')),
	CONSTRAINT "projects_client_required_chk" CHECK (type <> 'Client' OR client_id IS NOT NULL),
	CONSTRAINT "projects_dates_chk" CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
	CONSTRAINT "projects_budget_chk" CHECK (budget_amount IS NULL OR budget_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "files_id_company_id_unique" UNIQUE("id","company_id")
);
--> statement-breakpoint
CREATE TABLE "task_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"task_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignees_task_id_employee_id_pk" PRIMARY KEY("task_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"task_code" text NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"start_date" date,
	"due_date" date,
	"estimated_hours" numeric(7, 2),
	"actual_hours" numeric(7, 2),
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "tasks_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "tasks_company_id_task_code_unique" UNIQUE("company_id","task_code"),
	CONSTRAINT "tasks_status_chk" CHECK (status IN ('Pending', 'In Progress', 'In Review', 'Completed')),
	CONSTRAINT "tasks_priority_chk" CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
	CONSTRAINT "tasks_dates_chk" CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
	CONSTRAINT "tasks_hours_chk" CHECK ((estimated_hours IS NULL OR estimated_hours >= 0) AND (actual_hours IS NULL OR actual_hours >= 0))
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_sequences" ADD CONSTRAINT "code_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_employee_id_company_id_employees_id_company_id_fk" FOREIGN KEY ("employee_id","company_id") REFERENCES "public"."employees"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_company_id_roles_id_company_id_fk" FOREIGN KEY ("role_id","company_id") REFERENCES "public"."roles"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_company_id_roles_id_company_id_fk" FOREIGN KEY ("role_id","company_id") REFERENCES "public"."roles"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_company_id_roles_id_company_id_fk" FOREIGN KEY ("role_id","company_id") REFERENCES "public"."roles"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_company_id_clients_id_company_id_fk" FOREIGN KEY ("client_id","company_id") REFERENCES "public"."clients"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_employee_id_company_id_employees_id_company_id_fk" FOREIGN KEY ("employee_id","company_id") REFERENCES "public"."employees"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_company_id_clients_id_company_id_fk" FOREIGN KEY ("client_id","company_id") REFERENCES "public"."clients"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_employee_id_company_id_employees_id_company_id_fk" FOREIGN KEY ("owner_employee_id","company_id") REFERENCES "public"."employees"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_task_id_company_id_tasks_id_company_id_fk" FOREIGN KEY ("task_id","company_id") REFERENCES "public"."tasks"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_company_id_tasks_id_company_id_fk" FOREIGN KEY ("task_id","company_id") REFERENCES "public"."tasks"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_employee_id_company_id_employees_id_company_id_fk" FOREIGN KEY ("employee_id","company_id") REFERENCES "public"."employees"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_company_id_tasks_id_company_id_fk" FOREIGN KEY ("task_id","company_id") REFERENCES "public"."tasks"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_file_id_company_id_files_id_company_id_fk" FOREIGN KEY ("file_id","company_id") REFERENCES "public"."files"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_company_id_tasks_id_company_id_fk" FOREIGN KEY ("task_id","company_id") REFERENCES "public"."tasks"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_company_id_clients_id_company_id_fk" FOREIGN KEY ("client_id","company_id") REFERENCES "public"."clients"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "employees_company_status_idx" ON "employees" USING btree ("company_id","employment_status");--> statement-breakpoint
CREATE INDEX "client_notes_client_idx" ON "client_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_company_status_idx" ON "clients" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "project_members_employee_idx" ON "project_members" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "project_milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_company_status_idx" ON "projects" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "projects_company_due_idx" ON "projects" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "task_activity_task_idx" ON "task_activity_logs" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_assignees_employee_idx" ON "task_assignees" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "task_attachments_task_idx" ON "task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_company_status_idx" ON "tasks" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "tasks_company_due_idx" ON "tasks" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_client_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("company_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_idx" ON "activity_logs" USING btree ("company_id","created_at");