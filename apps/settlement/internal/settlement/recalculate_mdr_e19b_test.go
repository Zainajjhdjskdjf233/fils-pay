package settlement

import (
	"context"
	"testing"
	"time"
)

// E19 (rate-source part): recalculation with no rate change must not change a
// batch's fee. CloseBatch charged the fee_schedules rate minus the volume-tier
// bonus; recalculation used merchants.mdr_bps with no bonus.
func TestE19b_RecalcWithoutRateChangeChangesNothing(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()

	var saved int64
	if err := pool.QueryRow(ctx, `SELECT total_processed_fils FROM platform_stats WHERE id = 1`).Scan(&saved); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Exec(context.Background(), `UPDATE platform_stats SET total_processed_fils = $1 WHERE id = 1`, saved) //nolint:errcheck
	})
	if _, err := pool.Exec(ctx, `UPDATE platform_stats SET total_processed_fils = 2100000000 WHERE id = 1`); err != nil {
		t.Fatal(err)
	}

	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)
	if _, err := pool.Exec(ctx, `INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from) VALUES ($1, 200, $2)`, merchantID, start.AddDate(0, 0, -30)); err != nil {
		t.Fatal(err)
	}
	insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start.Add(time.Hour))
	closed, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil {
		t.Fatal(err)
	}
	if closed.FeeFils != 185 {
		t.Fatalf("setup: close fee = %d, want 185 (schedule 200 - tier 15)", closed.FeeFils)
	}

	res, err := RecalculateMDR(ctx, pool, merchantID, day, day.AddDate(0, 0, 1))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Adjusted) != 0 {
		t.Errorf("recalculation with no rate change adjusted the batch: %+v", res.Adjusted)
	}
}
