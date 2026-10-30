package settlement

import (
	"context"
	"testing"
	"time"
)

// E20: two schedule rows with the same effective_from — the one keyed in
// later wins, the same tie-break as apps/api feeSchedule.ts.
func TestE20_SameDayCorrectionWinsInGo(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	eff := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	// Insert the correction first so physical order cannot hide the bug.
	if _, err := pool.Exec(ctx, `INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from, created_at) VALUES ($1, 210, $2, $3)`, merchantID, eff, eff.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from, created_at) VALUES ($1, 200, $2, $3)`, merchantID, eff, eff); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	schedules, err := LoadFeeSchedules(ctx, tx, merchantID)
	if err != nil {
		t.Fatal(err)
	}
	if got := EffectiveMdrBpsAt(schedules, eff.AddDate(0, 0, 1), 250); got != 210 {
		t.Errorf("EffectiveMdrBpsAt = %d, want 210 (the later-entered same-day correction)", got)
	}
}
