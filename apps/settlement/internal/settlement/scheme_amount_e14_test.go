package settlement

import (
	"context"
	"testing"
	"time"
)

// E14: the scheme file's BD amount must be exactly amount_fils / 1000
// (ADR-0002). It was built from the untruncated gross and rounded half-up
// by NUMERIC(10,2), so it was always a few fils over.
func TestE14_SchemeAmountMatchesTruncatedFils(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)

	insertCaptureEvent(t, pool, merchantID, mdrBps, 39_705, start.Add(time.Hour))
	insertCaptureEvent(t, pool, merchantID, mdrBps, 4_747, start.Add(2*time.Hour))

	result, err := CloseBatch(context.Background(), pool, merchantID, day)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	rows, err := pool.Query(context.Background(), `
		SELECT amount_fils, amount::text FROM scheme_export_lines
		 WHERE settlement_batch_id = $1 ORDER BY amount_fils DESC
	`, result.BatchID)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	defer rows.Close()
	want := [][2]any{{int64(39_700), "39.70"}, {int64(4_740), "4.74"}}
	i := 0
	for rows.Next() {
		var fils int64
		var amount string
		if err := rows.Scan(&fils, &amount); err != nil {
			t.Fatalf("scan: %v", err)
		}
		if fils != want[i][0] || amount != want[i][1] {
			t.Errorf("line %d: amount_fils=%d amount=%s, want %d and %s", i, fils, amount, want[i][0], want[i][1])
		}
		i++
	}
	if i != 2 {
		t.Fatalf("got %d scheme lines, want 2", i)
	}
}
