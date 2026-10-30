-- E19 (rate-source part): CloseBatch subtracts the platform volume-tier
-- bonus from the MDR, but the bonus depends on platform volume AT CLOSE and
-- was not stored, so MDR recalculation could not reproduce it (it charged the
-- bonus back). Store it per batch. Older batches: 0 (same as before).
ALTER TABLE settlement_batches ADD COLUMN tier_bonus_bps INTEGER NOT NULL DEFAULT 0;
