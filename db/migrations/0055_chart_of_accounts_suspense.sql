-- Additional suspense accounts for future reconciliation lanes.

-- 0007's chart has columns (id, name, kind) and kind IN ('asset','liability','revenue');
-- suspense accounts are 'asset', like scheme_rounding_residue in 0007.
INSERT INTO chart_of_accounts (id, name, kind)
VALUES
  ('fx_rounding_difference', 'FX Rounding Difference (suspense)', 'asset'),
  ('chargeback_suspense', 'Chargeback Suspense', 'asset')
ON CONFLICT (id) DO NOTHING;
