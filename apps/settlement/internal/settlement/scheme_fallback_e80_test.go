package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/filspay/settlement/internal/money"
)

// E80 [found later]: when scheme_export_lines.amount is NULL, the fallback
// must still give exactly two decimals, truncated like TruncateToSchemeAmount
// (ADR-0002). `amount_fils::numeric / 1000` printed "4.7400000000000000".
func TestE80_SchemeFallbackHasTwoTruncatedDecimals(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	businessDate := time.Date(2026, 3, 25, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	insertCaptureEvent(t, pool, merchantID, mdrBps, money.Fils(4747), start.Add(time.Hour))

	result, err := CloseBatch(context.Background(), pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `UPDATE scheme_export_lines SET amount = NULL WHERE settlement_batch_id = $1`, result.BatchID); err != nil {
		t.Fatalf("null amount: %v", err)
	}
	lines, err := LoadSchemeExportLines(context.Background(), pool, result.BatchID)
	if err != nil {
		t.Fatalf("LoadSchemeExportLines: %v", err)
	}
	if len(lines) != 1 {
		t.Fatalf("expected 1 line, got %d", len(lines))
	}
	if lines[0].Amount != "4.74" {
		t.Fatalf("fallback amount = %q, want \"4.74\" (two decimals, truncated)", lines[0].Amount)
	}
}
