-- F01d (FP-212): refunds lower the payout. CloseBatch takes the merchant's
-- unbatched succeeded refunds (refunds.settlement_batch_id IS NULL, see
-- idx_refunds_merchant_unbatched in 0042) and freezes their totals here, so
-- a batch shows its own math:
--   net_payout_fils = gross_fils - fee_fils - refund_fils + fee_reversed_fils
ALTER TABLE settlement_batches
    ADD COLUMN refund_fils       BIGINT NOT NULL DEFAULT 0 CHECK (refund_fils >= 0),
    ADD COLUMN fee_reversed_fils BIGINT NOT NULL DEFAULT 0 CHECK (fee_reversed_fils >= 0);
