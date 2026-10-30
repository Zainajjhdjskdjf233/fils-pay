-- E121: manual credits, one-off balance adjustments and CSV adjustment imports
-- post to merchant_payable, but no batch ever paid them (CloseBatch built the
-- net from captures and refunds only). CloseBatch now takes them like refunds.
-- ledger_entries is append-only for the app roles (0082), so the groups a batch
-- took are recorded here; the primary key lets a group count in one batch only.
CREATE TABLE settlement_batch_ledger_groups (
    entry_group_id      UUID PRIMARY KEY,
    settlement_batch_id UUID NOT NULL REFERENCES settlement_batches (id),
    merchant_id         UUID NOT NULL REFERENCES merchants (id),
    amount_fils         BIGINT NOT NULL,          -- signed effect on merchant_payable
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_settlement_batch_ledger_groups_batch ON settlement_batch_ledger_groups (settlement_batch_id);

-- Signed: credits raise the payout, negative adjustments lower it.
--   net_payout_fils = gross_fils - fee_fils - refund_fils + fee_reversed_fils + credit_fils
ALTER TABLE settlement_batches ADD COLUMN credit_fils BIGINT NOT NULL DEFAULT 0;
