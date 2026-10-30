package splits

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/money"
)

func weights(ws ...int64) []ChildWeight {
	out := make([]ChildWeight, len(ws))
	for i, w := range ws {
		out[i] = ChildWeight{WeightBps: w}
	}
	return out
}

func sum(xs []money.Fils) money.Fils {
	var t money.Fils
	for _, x := range xs {
		t += x
	}
	return t
}

// E17: shares must always add up to the parent's net payout.
func TestE17_SharesAlwaysSumToNet(t *testing.T) {
	for _, net := range []money.Fils{0, 1, 2, 3, 7, 999, 4751, 10_001, 123_457} {
		for _, ws := range [][]int64{{5000, 3000, 2000}, {3333, 3333, 3334}, {1, 9999}, {10000}} {
			got := ChildShares(net, weights(ws...))
			if sum(got) != net {
				t.Errorf("net %d weights %v: shares %v sum %d", net, ws, got, sum(got))
			}
			for _, s := range got {
				if s < 0 {
					t.Errorf("negative share %v", got)
				}
			}
		}
	}
}

func TestE17_LargestRemainderValues(t *testing.T) {
	got := ChildShares(4751, weights(5000, 3000, 2000))
	want := []money.Fils{2376, 1425, 950} // same as packages/money allocateRemainder
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ChildShares(4751, 50/30/20) = %v, want %v", got, want)
		}
	}
}

// E17 Decision (for Zainab to review): weights that do not total 10000 are
// split in proportion to their own total, so no fils go missing.
func TestE17_WeightsNotTotalling10000StillSumToNet(t *testing.T) {
	got := ChildShares(1001, weights(3000, 3000))
	if sum(got) != 1001 {
		t.Fatalf("shares %v sum %d, want 1001", got, sum(got))
	}
}

func TestE17_SplitPayoutPaysTheWholeNet(t *testing.T) {
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
			"e17-"+uuid.New().String()).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	parent := merchant()
	for _, w := range []int64{5000, 3000, 2000} {
		if _, err := pool.Exec(ctx, `INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, $3)`,
			parent, merchant(), w); err != nil {
			t.Fatal(err)
		}
	}
	var batchID uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
		VALUES ($1, '2026-04-25', 'closed', 3, 0, 3, now()) RETURNING id`, parent).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO merchant_balances (merchant_id, cached_payable_fils, last_settlement_batch_id) VALUES ($1, 3, $2)`, parent, batchID); err != nil {
		t.Fatal(err)
	}

	if _, err := PayoutSplitBatch(ctx, pool, batchID); err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}
	var allocated, debited, cache int64
	pool.QueryRow(ctx, `SELECT COALESCE(SUM(allocated_fils),0) FROM settlement_batch_splits WHERE settlement_batch_id = $1`, batchID).Scan(&allocated)
	pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_fils),0) FROM ledger_entries WHERE settlement_batch_id = $1 AND account_id = 'merchant_payable' AND direction = 'debit'`, batchID).Scan(&debited)
	pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, parent).Scan(&cache)
	if allocated != 3 || debited != 3 || cache != 0 {
		t.Errorf("net 3 split 50/30/20: allocated %d, debited %d, cache %d; want 3, 3, 0", allocated, debited, cache)
	}
}
