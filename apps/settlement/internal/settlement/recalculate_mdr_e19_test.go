package settlement

import (
	"context"
	"testing"
	"time"
)

// E19: MDR recalculation must never change a batch that was already paid.
func TestE19_PaidBatchUntouchedClosedBatchAdjusted(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day1 := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	s1, _ := BusinessDayWindow(day1)
	s2, _ := BusinessDayWindow(day2)

	insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, s1.Add(time.Hour))
	insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, s2.Add(time.Hour))
	paid, err := CloseBatch(ctx, pool, merchantID, day1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := PayoutBatch(ctx, pool, paid.BatchID); err != nil {
		t.Fatal(err)
	}
	closed, err := CloseBatch(ctx, pool, merchantID, day2)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 300 WHERE id = $1`, merchantID); err != nil {
		t.Fatal(err)
	}
	res, err := RecalculateMDR(ctx, pool, merchantID, day1, day2.AddDate(0, 0, 1))
	if err != nil {
		t.Fatal(err)
	}

	var paidFee, paidNet, closedFee int64
	pool.QueryRow(ctx, `SELECT fee_fils, net_payout_fils FROM settlement_batches WHERE id = $1`, paid.BatchID).Scan(&paidFee, &paidNet)
	pool.QueryRow(ctx, `SELECT fee_fils FROM settlement_batches WHERE id = $1`, closed.BatchID).Scan(&closedFee)
	if paidFee != int64(paid.FeeFils) || paidNet != int64(paid.NetPayoutFils) {
		t.Errorf("paid batch changed: fee %d -> %d, net %d -> %d", paid.FeeFils, paidFee, paid.NetPayoutFils, paidNet)
	}
	if closedFee == int64(closed.FeeFils) {
		t.Errorf("closed (unpaid) batch was not recalculated: fee still %d", closedFee)
	}
	for _, a := range res.Adjusted {
		if a.BatchID == paid.BatchID {
			t.Errorf("RecalculateMDR reported an adjustment for the paid batch")
		}
	}
	if n := countRows(t, pool, `SELECT COUNT(*) FROM ledger_entries WHERE settlement_batch_id = $1 AND description LIKE '%MDR%'`, paid.BatchID); n != 0 {
		t.Errorf("%d MDR adjustment ledger rows posted against the paid batch", n)
	}
}
