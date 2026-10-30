package settlement

import (
	"context"
	"testing"
	"time"
)

// E73 (ADR-0002): CloseBatch must journal each scheme line's rounding residue
// (gross - truncated amount_fils): credit card_scheme_clearing, debit
// scheme_rounding_residue, one balanced group per line with a residue.
func TestE73_SchemeResidueIsJournaled(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 5, 18, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)
	insertCaptureEvent(t, pool, merchantID, mdrBps, 4_755, start.Add(time.Hour)) // residue 5
	insertCaptureEvent(t, pool, merchantID, mdrBps, 3_000, start.Add(2*time.Hour)) // residue 0

	res, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil {
		t.Fatal(err)
	}
	var residueDebit, clearingCredit, groups int64
	err = pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_fils) FILTER (WHERE account_id = 'scheme_rounding_residue' AND direction = 'debit'), 0),
		       COALESCE(SUM(amount_fils) FILTER (WHERE account_id = 'card_scheme_clearing' AND direction = 'credit'), 0),
		       COUNT(DISTINCT entry_group_id)
		  FROM ledger_entries WHERE settlement_batch_id = $1 AND description LIKE 'scheme rounding residue%'
	`, res.BatchID).Scan(&residueDebit, &clearingCredit, &groups)
	if err != nil {
		t.Fatal(err)
	}
	if residueDebit != 5 || clearingCredit != 5 || groups != 1 {
		t.Errorf("residue debit %d, clearing credit %d, groups %d; want 5, 5, 1 (only the 4755 line has a residue)", residueDebit, clearingCredit, groups)
	}
}
