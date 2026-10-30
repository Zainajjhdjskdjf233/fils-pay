-- E31 (speed part): the settlement summary scans capture events by time for
-- one merchant. Without this index Postgres read the whole table
-- (docs/perf/2026-07-settlement-summary-slow.md: Seq Scan, 402,911 rows).
-- Partial (captures only) and covering, so the window is read from the index.
-- Measured on a 409k-event copy (serial plan): 66 ms -> 52 ms, Seq Scan ->
-- Bitmap Index Scan; the gain grows with history, the scan no longer does.
CREATE INDEX idx_transaction_events_capture_time
    ON transaction_events (occurred_at) INCLUDE (transaction_id, amount_fils)
    WHERE event_type IN ('captured', 'partially_captured');
