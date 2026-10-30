package splits

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// E48 (rest): a split payout must add the batch net to the parent's
// lifetime payout estimate, as PayoutBatch does for a non-split merchant
// (settlement/batch.go:427). It was skipped for split merchants.
func TestE48_SplitPayoutUpdatesTheLifetimeEstimate(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	merchant := func() uuid.UUID {
		var id uuid.UUID
		if err := pool.QueryRow(ctx, `INSERT INTO merchants (display_name, mdr_bps, status, test_mode) VALUES ($1, 250, 'active', false) RETURNING id`,
			"e48-"+uuid.New().String()).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	parent := merchant()
	if _, err := pool.Exec(ctx, `INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, 10000)`, parent, merchant()); err != nil {
		t.Fatal(err)
	}
	var batchID uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
		VALUES ($1, '2026-04-26', 'closed', 10000, 250, 9750, now()) RETURNING id`, parent).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO merchant_balances (merchant_id, cached_payable_fils, last_settlement_batch_id) VALUES ($1, 9750, $2)`, parent, batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := PayoutSplitBatch(ctx, pool, batchID); err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}
	var lifetime int64
	if err := pool.QueryRow(ctx, `SELECT lifetime_net_payout_monitoring_estimate FROM merchants WHERE id = $1`, parent).Scan(&lifetime); err != nil {
		t.Fatal(err)
	}
	if lifetime != 9750 {
		t.Fatalf("lifetime estimate = %d, want 9750", lifetime)
	}
}
