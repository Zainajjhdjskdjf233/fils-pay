-- E42: the reporting cursor read `id > last_processed_id`, but ids are taken
-- when a transaction writes, not when it commits; a slow transaction could
-- commit a LOWER id after a higher one was already processed, and it was
-- skipped forever. Each event now records its transaction id (xid8); the
-- consumer only reads events from transactions older than the oldest still
-- running (pg_snapshot_xmin), ordered by (txid, id), and keeps its cursor on
-- that pair. No transaction can later commit behind that cursor.
--
-- Old rows get the sentinel txid 0 (a constant default: no table rewrite).
-- An existing cursor becomes (0, last_processed_id): old rows above it are
-- still processed, and every new row has a real xid (>= 3), so it is always
-- above the cursor — including a transaction that started before this
-- migration and commits after it (fix-reviewer).
ALTER TABLE outbox_events ADD COLUMN txid xid8 NOT NULL DEFAULT '0';
ALTER TABLE outbox_events ALTER COLUMN txid SET DEFAULT pg_current_xact_id();
CREATE INDEX outbox_events_txid_id_idx ON outbox_events (txid, id);

ALTER TABLE reporting_outbox_cursor ADD COLUMN last_processed_txid xid8 NOT NULL DEFAULT '0';
