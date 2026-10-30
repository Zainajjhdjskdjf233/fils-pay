package settlement

import (
	"context"
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// E24: the lifetime payout estimate must add exact integer fils.
func TestE24_LifetimeEstimateIsExact(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	for i := 0; i < 1000; i++ {
		if err := UpdateLifetimePayoutMonitoringEstimate(ctx, tx, merchantID, money.Fils(123_457)); err != nil {
			t.Fatal(err)
		}
	}
	var got string
	if err := tx.QueryRow(ctx, `SELECT lifetime_net_payout_monitoring_estimate::text FROM merchants WHERE id = $1`, merchantID).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "123457000" {
		t.Errorf("estimate = %s after 1000 × 123457, want 123457000", got)
	}
}

// E25: the platform volume counter must not overflow past int32.
func TestE25_PlatformVolumeDoesNotOverflow(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // leave the shared counter as it was
	if _, err := tx.Exec(ctx, `UPDATE platform_stats SET total_processed_fils = 1999000000 WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	current, err := ReadAndLockPlatformProcessedFils(ctx, tx)
	if err != nil {
		t.Fatal(err)
	}
	if err := RecordPlatformProcessedVolume(ctx, tx, current, 200_000_000); err != nil {
		t.Fatalf("RecordPlatformProcessedVolume: %v", err)
	}
	var got string
	if err := tx.QueryRow(ctx, `SELECT total_processed_fils::text FROM platform_stats WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != "2199000000" {
		t.Errorf("total_processed_fils = %s, want 2199000000", got)
	}
	if bonus := VolumeTierMdrBonusBps(2_199_000_000); bonus != 15 {
		t.Errorf("tier bonus above threshold = %d, want 15", bonus)
	}
}
