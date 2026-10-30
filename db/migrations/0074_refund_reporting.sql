-- F01e (FP-212): refunds in the reports.
--
-- 1. merchant_daily_volume gets the two refund columns the reporting
--    worker's refund rollup (apps/reporting applyEvent.ts) already writes.
ALTER TABLE merchant_daily_volume
    ADD COLUMN refund_count      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN refund_gross_fils BIGINT  NOT NULL DEFAULT 0;

-- 2. E43: 0072 joined transactions on the REFUND id (t.id = r.id), so the
--    view had no rows. Rebuilt with the right join. A new migration, not an
--    edit of 0072, because 0072 runs fine and may already be applied.
DROP MATERIALIZED VIEW refund_merchant_summary;

CREATE MATERIALIZED VIEW refund_merchant_summary AS
SELECT
    r.merchant_id,
    (r.occurred_at AT TIME ZONE 'Asia/Bahrain')::date AS business_date,
    COUNT(*)                 AS refund_count,
    SUM(r.amount_fils)       AS total_refunded_fils,
    SUM(r.fee_reversed_fils) AS total_fee_reversed_fils,
    SUM(t.captured_fils)     AS original_captured_fils
FROM refunds r
JOIN transactions t ON t.id = r.transaction_id
WHERE r.status = 'succeeded'
GROUP BY r.merchant_id, (r.occurred_at AT TIME ZONE 'Asia/Bahrain')::date;

CREATE UNIQUE INDEX idx_refund_merchant_summary_pk
    ON refund_merchant_summary (merchant_id, business_date);
