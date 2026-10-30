package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// insertPayableAdjustment posts a balanced group the way the API does
// (ledgerAdjustments.ts): positive credits merchant_payable, negative debits it.
func insertPayableAdjustment(t *testing.T, pool *pgxpool.Pool, merchantID uuid.UUID, amount int64, description string, at time.Time) uuid.UUID {
	t.Helper()
	g := uuid.New()
	payableDir, contraDir, mag := "credit", "debit", amount
	if amount < 0 {
		payableDir, contraDir, mag = "debit", "credit", -amount
	}
	_, err := pool.Exec(context.Background(), `
		INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
		VALUES ($1, $2, 'manual_balance_adjustment_contra', $3, $5, $6, $7),
		       ($1, $2, 'merchant_payable',                 $4, $5, $6, $7)
	`, g, merchantID, contraDir, payableDir, mag, at, description)
	if err != nil {
		t.Fatalf("insertPayableAdjustment: %v", err)
	}
	return g
}

func batchCreditFils(t *testing.T, pool *pgxpool.Pool, batchID uuid.UUID) int64 {
	t.Helper()
	var c int64
	if err := pool.QueryRow(context.Background(), `SELECT credit_fils FROM settlement_batches WHERE id = $1`, batchID).Scan(&c); err != nil {
		t.Fatalf("batchCreditFils: %v", err)
	}
	return c
}

// E121 [deep review]: a manual credit is paid in the next batch, exactly once.
func TestE121_CreditIsPaidOnceThroughTheBatch(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day1 := time.Date(2026, 5, 18, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	s1, _ := BusinessDayWindow(day1)

	_, fee := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, s1.Add(time.Hour))
	insertPayableAdjustment(t, pool, merchantID, 2_000, "manual balance adjustment", s1.Add(2*time.Hour))

	b1, err := CloseBatch(ctx, pool, merchantID, day1)
	if err != nil {
		t.Fatal(err)
	}
	if want := 10_000 - int64(fee) + 2_000; int64(b1.NetPayoutFils) != want {
		t.Errorf("day-1 net payout = %d, want %d (capture net + 2.000 BD credit)", b1.NetPayoutFils, want)
	}
	if c := batchCreditFils(t, pool, b1.BatchID); c != 2_000 {
		t.Errorf("day-1 credit_fils = %d, want 2000", c)
	}
	b2, err := CloseBatch(ctx, pool, merchantID, day2)
	if err != nil {
		t.Fatal(err)
	}
	if b2.NetPayoutFils != 0 {
		t.Errorf("day-2 net payout = %d, want 0 (the credit was already paid on day 1)", b2.NetPayoutFils)
	}
}

// E121: a negative adjustment larger than the day's payout waits for a day
// with enough payout; the payout never goes negative.
func TestE121_NegativeAdjustmentCarriesOver(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day1 := time.Date(2026, 5, 25, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	s1, _ := BusinessDayWindow(day1)
	s2, _ := BusinessDayWindow(day2)

	_, fee1 := insertCaptureEvent(t, pool, merchantID, mdrBps, 1_000, s1.Add(time.Hour))
	insertPayableAdjustment(t, pool, merchantID, -5_000, "CSV adjustment import", s1.Add(2*time.Hour))
	b1, err := CloseBatch(ctx, pool, merchantID, day1)
	if err != nil {
		t.Fatal(err)
	}
	if want := 1_000 - int64(fee1); int64(b1.NetPayoutFils) != want || batchCreditFils(t, pool, b1.BatchID) != 0 {
		t.Errorf("day 1: net %d credit %d, want net %d and the -5000 carried", b1.NetPayoutFils, batchCreditFils(t, pool, b1.BatchID), want)
	}

	_, fee2 := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, s2.Add(time.Hour))
	b2, err := CloseBatch(ctx, pool, merchantID, day2)
	if err != nil {
		t.Fatal(err)
	}
	if want := 10_000 - int64(fee2) - 5_000; int64(b2.NetPayoutFils) != want {
		t.Errorf("day-2 net payout = %d, want %d (the carried -5.000 BD taken)", b2.NetPayoutFils, want)
	}
	if c := batchCreditFils(t, pool, b2.BatchID); c != -5_000 {
		t.Errorf("day-2 credit_fils = %d, want -5000", c)
	}
}
