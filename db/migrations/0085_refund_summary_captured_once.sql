-- E67 (my own F01e bug, 0074): refund_merchant_summary summed
-- t.captured_fils once per REFUND, so two refunds of one transaction on one
-- day doubled original_captured_fils. Rebuilt so each transaction's captured
-- amount counts once per (merchant, business day). Nothing in the app reads
-- this view (only a test), so dropping and recreating it is safe.
DROP MATERIALIZED VIEW refund_merchant_summary;

CREATE MATERIALIZED VIEW refund_merchant_summary AS
WITH day_refunds AS (
    SELECT r.merchant_id,
           (r.occurred_at AT TIME ZONE 'Asia/Bahrain')::date AS business_date,
           r.transaction_id,
           r.amount_fils,
           r.fee_reversed_fils
      FROM refunds r
     WHERE r.status = 'succeeded'
),
day_transactions AS (
    SELECT DISTINCT merchant_id, business_date, transaction_id FROM day_refunds
)
SELECT d.merchant_id,
       d.business_date,
       COUNT(*)                 AS refund_count,
       SUM(d.amount_fils)       AS total_refunded_fils,
       SUM(d.fee_reversed_fils) AS total_fee_reversed_fils,
       (SELECT COALESCE(SUM(t.captured_fils), 0)
          FROM day_transactions dt
          JOIN transactions t ON t.id = dt.transaction_id
         WHERE dt.merchant_id = d.merchant_id AND dt.business_date = d.business_date) AS original_captured_fils
  FROM day_refunds d
 GROUP BY d.merchant_id, d.business_date;

CREATE UNIQUE INDEX idx_refund_merchant_summary_pk
    ON refund_merchant_summary (merchant_id, business_date);
