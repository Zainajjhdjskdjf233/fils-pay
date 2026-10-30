-- E92 (partly): the ledger and the admin audit log are append-only for the
-- application. 0007's "immutability" comment was false — its trigger only
-- checks that a group still balances. No application code updates or deletes
-- these rows (grep), so the per-service roles (ops/postgres/01-roles.sh) lose
-- UPDATE, DELETE and TRUNCATE on them. Corrections are new reversing entries.
-- Only acts where those roles exist (the hosted stack), so test databases and
-- local runs without them are unchanged.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['filspay_api', 'filspay_settlement', 'filspay_reporting'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entries, admin_audit_log FROM %I', r);
    END IF;
  END LOOP;
END $$;
