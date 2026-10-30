-- E131: the discount-adjustment sweep (and applyCaptureDiscountAdjustment)
-- count a transaction's adjustment credits; ledger_entries had no index on
-- transaction_id (only merchant_id, occurred_at in 0007), so each count could
-- scan the whole ledger. A small partial index covers exactly those rows.
CREATE INDEX IF NOT EXISTS idx_ledger_discount_adjustments
    ON ledger_entries (transaction_id)
    WHERE description = 'capture: negotiated discount adjustment';
