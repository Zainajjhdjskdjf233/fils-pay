package internalapi

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/filspay/settlement/internal/settlement"
)

// E48: the admin "Run batch" path (POST /internal/run-batch) paid batches but
// never enqueued the settlement.paid notification; only the daemon tick did,
// so the merchant heard about an admin-run payout only at the next wake.
func TestE48_RunBatchEnqueuesThePayoutNotification(t *testing.T) {
	pool := mustPool(t)
	server := newTestServer(t, pool)

	merchantID := insertActiveMerchant(t, pool)
	businessDate := time.Date(2026, 4, 11, 0, 0, 0, 0, time.UTC)
	start, _ := settlement.BusinessDayWindow(businessDate)
	insertCaptureEvent(t, pool, merchantID, 10000, start.Add(time.Hour))

	resp := post(t, server, "/internal/run-batch", "Bearer "+testToken, `{"date":"2026-04-11","merchantId":"`+merchantID.String()+`"}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var report runBatchResponse
	decodeJSON(t, resp, &report)
	if len(report.MerchantResults) != 1 {
		t.Fatalf("merchantResults = %d, want 1", len(report.MerchantResults))
	}
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM outbox_events WHERE event_type = 'settlement.paid' AND aggregate_id = $1`,
		report.MerchantResults[0].BatchID).Scan(&n); err != nil {
		t.Fatalf("count outbox: %v", err)
	}
	if n != 1 {
		t.Fatalf("settlement.paid events for the batch = %d, want 1", n)
	}
}
