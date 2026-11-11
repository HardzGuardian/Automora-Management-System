-- Audit tables are append-only (ADR-09): reject UPDATE and DELETE for every role.
CREATE FUNCTION reject_audit_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER activity_logs_append_only
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_modification();
--> statement-breakpoint
CREATE TRIGGER task_activity_logs_append_only
  BEFORE UPDATE OR DELETE ON task_activity_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_modification();
