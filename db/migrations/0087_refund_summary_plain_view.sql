-- E67 (rest): nothing ever ran REFRESH MATERIALIZED VIEW, so in real use
-- refund_merchant_summary stayed empty. Refreshing needs the view's owner,
-- and the reporting worker is not the owner (migrations run as
-- filspay_owner, which cannot hand ownership to another role). A plain view
-- needs no refresh and is always current. Nothing in the app reads it (only
-- tests), and the refunds table is small, so computing it on read is fine.
-- Same columns and meaning as 0085 (captured amount once per transaction).
DROP MATERIALIZED VIEW refund_merchant_summary;

CREATE VIEW refund_merchant_summary AS
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
