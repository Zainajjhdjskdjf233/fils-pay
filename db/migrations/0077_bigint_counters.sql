-- E24: the lifetime payout monitoring estimate was REAL (float, ~7 digits);
-- E25: the platform volume counter was INTEGER (int32), which overflows
-- just above the 2,000,000,000-fils volume-tier threshold. Both are money
-- totals in fils: BIGINT.
ALTER TABLE merchants
    ALTER COLUMN lifetime_net_payout_monitoring_estimate TYPE BIGINT
    USING round(lifetime_net_payout_monitoring_estimate)::bigint;

ALTER TABLE platform_stats
    ALTER COLUMN total_processed_fils TYPE BIGINT;
