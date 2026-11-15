ALTER TABLE "tasks" DROP CONSTRAINT "tasks_priority_chk";--> statement-breakpoint
-- The design has three priorities. Anything that was Urgent is now High (tasks and the saved default).
UPDATE "tasks" SET "priority" = 'High' WHERE "priority" = 'Urgent';--> statement-breakpoint
UPDATE "company_settings" SET "setting_value_json" = '"High"'::jsonb WHERE "setting_key" = 'tasks.defaultPriority' AND "setting_value_json" = '"Urgent"'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_chk" CHECK (priority IN ('Low', 'Medium', 'High'));
