CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"type" text NOT NULL,
	"actor_id" text,
	"subject" text,
	"ip" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_events_type_chk" CHECK (type IN ('login_failed', 'login_blocked', 'permission_denied', 'job_failed'))
);
--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_company_idx" ON "security_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "security_events_type_idx" ON "security_events" USING btree ("type","created_at");
--> statement-breakpoint
-- Append-only like the audit tables: the monitoring log cannot be edited or erased by the application.
CREATE TRIGGER security_events_append_only
  BEFORE UPDATE OR DELETE ON security_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_modification();
