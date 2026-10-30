package settlement

import (
	"context"
	"testing"
	"time"
)

// E120 [deep review]: a fee raise larger than a batch's net payout (after
// refunds) must not store a negative net_payout_fils. The batch is skipped and
// reported instead; nothing is posted for it.
func TestE120_RecalcNeverMakesNetPayoutNegative(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)

	// 10.000 BD captured (fee 250), 9.700 BD refunded: net 50 fils.
	txnID, _ := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start.Add(time.Hour))
	insertRefund(t, pool, merchantID, txnID, 9_700, 0, "succeeded", start.Add(2*time.Hour))
	closed, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil {
		t.Fatal(err)
	}
	if closed.NetPayoutFils != 50 {
		t.Fatalf("setup: net payout %d, want 50", closed.NetPayoutFils)
	}

	// Fee raised to 20 %: new fee 2000, diff 1750 > net 50.
	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 2000 WHERE id = $1`, merchantID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM fee_schedules WHERE merchant_id = $1`, merchantID); err != nil {
		t.Fatal(err)
	}
	res, err := RecalculateMDR(ctx, pool, merchantID, day, day.AddDate(0, 0, 1))
	if err != nil {
		t.Fatal(err)
	}

	var fee, net int64
	pool.QueryRow(ctx, `SELECT fee_fils, net_payout_fils FROM settlement_batches WHERE id = $1`, closed.BatchID).Scan(&fee, &net)
	if net < 0 {
		t.Fatalf("net_payout_fils = %d after recalculation; a batch can never owe a negative payout", net)
	}
	if fee != int64(closed.FeeFils) || net != int64(closed.NetPayoutFils) {
		t.Errorf("skipped batch changed: fee %d -> %d, net %d -> %d", closed.FeeFils, fee, closed.NetPayoutFils, net)
	}
	if len(res.Adjusted) != 0 {
		t.Errorf("Adjusted = %v, want none", res.Adjusted)
	}
	if len(res.Skipped) != 1 || res.Skipped[0].BatchID != closed.BatchID {
		t.Errorf("Skipped = %v, want the one batch", res.Skipped)
	}
	if n := countRows(t, pool, `SELECT COUNT(*) FROM ledger_entries WHERE settlement_batch_id = $1 AND description LIKE '%MDR%'`, closed.BatchID); n != 0 {
		t.Errorf("%d MDR adjustment ledger rows posted for a skipped batch", n)
	}
}
