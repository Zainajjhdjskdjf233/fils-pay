package internalapi

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/filspay/settlement/internal/ledger"
)

// E18 (FP-203): the admin "Rebuild cached balances" button must give the
// same number as the CLI rebuild: the merchant_payable ledger balance.
func TestE18_ButtonMatchesLedgerLikeTheCLI(t *testing.T) {
	pool := mustPool(t)
	server := newTestServer(t, pool)
	ctx := context.Background()

	merchantID := insertActiveMerchant(t, pool)
	txnID := insertCaptureEvent(t, pool, merchantID, 10_000, time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC))
	// Fee legs: merchant_payable goes down by 250. Scheme lines never see this.
	if _, err := pool.Exec(ctx, `
		INSERT INTO ledger_entries (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
		VALUES ($1, $2, $3, 'merchant_payable', 'debit', 250, now(), 'capture: MDR fee'),
		       ($1, $2, $3, 'platform_fee_revenue', 'credit', 250, now(), 'capture: MDR fee')
	`, uuid.New(), merchantID, txnID); err != nil {
		t.Fatal(err)
	}
	var batchID uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
		VALUES ($1, '2026-04-13', 'closed', 10000, 250, 9750, now()) RETURNING id
	`, merchantID).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO scheme_export_lines (settlement_batch_id, transaction_id, amount_fils, line_sequence) VALUES ($1, $2, 10000, 1)`, batchID, txnID); err != nil {
		t.Fatal(err)
	}

	resp := post(t, server, "/internal/rebuild-balances", "Bearer "+testToken, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	var diffs map[string]rebuildDiffResponse
	decodeJSON(t, resp, &diffs)

	cli, err := ledger.RebuildMerchantBalance(ctx, pool, merchantID)
	if err != nil {
		t.Fatal(err)
	}
	if got := diffs[merchantID.String()].After; got != int64(cli) || got != 9_750 {
		t.Errorf("button after = %d, CLI = %d, want both 9750 (10000 - 250 fee)", got, cli)
	}
}

// E18: `rebuild-balances --merchant` must write the cache it computes.
func TestE18_SingleMerchantRebuildWritesTheCache(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool)
	insertCaptureEvent(t, pool, merchantID, 7_000, time.Date(2026, 4, 14, 9, 0, 0, 0, time.UTC))
	if _, err := pool.Exec(ctx, `INSERT INTO merchant_balances (merchant_id, cached_payable_fils) VALUES ($1, 135000)`, merchantID); err != nil {
		t.Fatal(err)
	}
	if _, err := ledger.RebuildMerchantBalance(ctx, pool, merchantID); err != nil {
		t.Fatal(err)
	}
	var cached int64
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&cached); err != nil {
		t.Fatal(err)
	}
	if cached != 7_000 {
		t.Errorf("cached_payable_fils = %d after rebuild --merchant, want 7000", cached)
	}
}
