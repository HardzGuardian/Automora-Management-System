ALTER TABLE "tasks" DROP CONSTRAINT "tasks_priority_chk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_chk" CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'));