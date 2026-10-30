package settlement

import (
	"context"
	"sync"
	"testing"
	"time"
)

// E30 (incident 2026-08-21): the daemon and the CLI scanning at the same time
// must enqueue exactly one settlement.paid event per paid batch.
func TestE30_ConcurrentScansNotifyOnce(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 30; i++ {
		if _, err := pool.Exec(ctx, `
			INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at, paid_at)
			VALUES ($1, $2, 'paid', 1000, 25, 975, now(), now())
		`, merchantID, day.AddDate(0, 0, i)); err != nil {
			t.Fatal(err)
		}
	}

	for round := 0; round < 3; round++ {
		var wg sync.WaitGroup
		for p := 0; p < 2; p++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if _, err := EnqueuePayoutNotifications(ctx, pool); err != nil {
					t.Errorf("EnqueuePayoutNotifications: %v", err)
				}
			}()
		}
		wg.Wait()
	}

	dupes := countRows(t, pool, `
		SELECT COUNT(*) FROM (
		  SELECT oe.aggregate_id FROM outbox_events oe
		    JOIN settlement_batches sb ON sb.id = oe.aggregate_id
		   WHERE oe.event_type = 'settlement.paid' AND sb.merchant_id = $1
		   GROUP BY oe.aggregate_id HAVING COUNT(*) > 1
		) d`, merchantID)
	total := countRows(t, pool, `
		SELECT COUNT(*) FROM outbox_events oe JOIN settlement_batches sb ON sb.id = oe.aggregate_id
		 WHERE oe.event_type = 'settlement.paid' AND sb.merchant_id = $1`, merchantID)
	if dupes != 0 || total != 30 {
		t.Errorf("%d batches notified more than once; %d events for 30 batches", dupes, total)
	}
}
