-- E92: the comment in 0007 says the ledger is immutable, but nothing stopped
-- an UPDATE or DELETE (0082 only revoked them from the app roles; the owner
-- and superusers could still change history). These triggers make both
-- tables append-only for everyone. TRUNCATE (dev seed only) is a separate
-- statement and is not affected by row triggers.
CREATE OR REPLACE FUNCTION reject_ledger_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed (post a correcting entry instead)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_change();

-- admin_audit_log: rows are never deleted; the only allowed update is the
-- one apps/api/src/adminAudit/log.ts:112 makes when an action finishes
-- (outcome and metadata). Every other column is frozen.
CREATE OR REPLACE FUNCTION guard_admin_audit_log() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'admin_audit_log is append-only: DELETE is not allowed';
    END IF;
    IF (to_jsonb(NEW) - 'outcome' - 'metadata') IS DISTINCT FROM (to_jsonb(OLD) - 'outcome' - 'metadata') THEN
        RAISE EXCEPTION 'admin_audit_log: only outcome and metadata may be updated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_log_append_only
    BEFORE UPDATE OR DELETE ON admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION guard_admin_audit_log();
