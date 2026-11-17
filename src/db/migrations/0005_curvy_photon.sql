CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "departments_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "departments_company_id_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "project_teams" (
	"project_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_teams_project_id_team_id_pk" PRIMARY KEY("project_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "task_teams" (
	"task_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_teams_task_id_team_id_pk" PRIMARY KEY("task_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_employee_id_pk" PRIMARY KEY("team_id","employee_id"),
	CONSTRAINT "team_members_role_chk" CHECK (role IN ('lead', 'member'))
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "teams_id_company_id_unique" UNIQUE("id","company_id"),
	CONSTRAINT "teams_department_id_name_unique" UNIQUE("department_id","name")
);
--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "via_team_id" uuid;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD COLUMN "via_team_id" uuid;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_project_id_company_id_projects_id_company_id_fk" FOREIGN KEY ("project_id","company_id") REFERENCES "public"."projects"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_team_id_company_id_teams_id_company_id_fk" FOREIGN KEY ("team_id","company_id") REFERENCES "public"."teams"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_teams" ADD CONSTRAINT "task_teams_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_teams" ADD CONSTRAINT "task_teams_task_id_company_id_tasks_id_company_id_fk" FOREIGN KEY ("task_id","company_id") REFERENCES "public"."tasks"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_teams" ADD CONSTRAINT "task_teams_team_id_company_id_teams_id_company_id_fk" FOREIGN KEY ("team_id","company_id") REFERENCES "public"."teams"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_company_id_teams_id_company_id_fk" FOREIGN KEY ("team_id","company_id") REFERENCES "public"."teams"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_employee_id_company_id_employees_id_company_id_fk" FOREIGN KEY ("employee_id","company_id") REFERENCES "public"."employees"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_company_id_departments_id_company_id_fk" FOREIGN KEY ("department_id","company_id") REFERENCES "public"."departments"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_teams_team_idx" ON "project_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "task_teams_team_idx" ON "task_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_employee_idx" ON "team_members" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "teams_department_idx" ON "teams" USING btree ("department_id");