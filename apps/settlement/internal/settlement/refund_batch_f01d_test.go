package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/money"
)

// F01d: refunds lower the shop's payout. CloseBatch takes the merchant's
// unbatched succeeded refunds, subtracts (amount - fee reversed) from the
// net payout, and stamps each refund with the batch id so it counts once.

func insertRefund(t *testing.T, pool *pgxpool.Pool, merchantID, txnID uuid.UUID, amountFils, feeReversedFils money.Fils, status string, occurredAt time.Time) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO refunds (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status,
		                     acquirer_reference, reason, created_by_type, created_by_id, occurred_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'test', 'merchant_api_key', $7, $8)
		RETURNING id
	`, txnID, merchantID, int64(amountFils), int64(feeReversedFils), status, "acq-refund-"+uuid.New().String(), uuid.New(), occurredAt).Scan(&id)
	if err != nil {
		t.Fatalf("insertRefund: %v", err)
	}
	return id
}

func batchRefundTotals(t *testing.T, pool *pgxpool.Pool, batchID uuid.UUID) (refundFils, feeReversedFils, netFils int64) {
	t.Helper()
	err := pool.QueryRow(context.Background(), `
		SELECT refund_fils, fee_reversed_fils, net_payout_fils FROM settlement_batches WHERE id = $1
	`, batchID).Scan(&refundFils, &feeReversedFils, &netFils)
	if err != nil {
		t.Fatalf("batchRefundTotals: %v", err)
	}
	return
}

func refundBatchID(t *testing.T, pool *pgxpool.Pool, refundID uuid.UUID) *uuid.UUID {
	t.Helper()
	var id *uuid.UUID
	if err := pool.QueryRow(context.Background(), `SELECT settlement_batch_id FROM refunds WHERE id = $1`, refundID).Scan(&id); err != nil {
		t.Fatalf("refundBatchID: %v", err)
	}
	return id
}

func TestF01d_RefundReducesNetPayout(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 4, 10, 0, 0, 0, 0, time.UTC)
	start, end := BusinessDayWindow(day)

	txnID, fee := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start.Add(2*time.Hour))
	refundID := insertRefund(t, pool, merchantID, txnID, 1_250, 31, "succeeded", start.Add(3*time.Hour))
	failedID := insertRefund(t, pool, merchantID, txnID, 500, 12, "failed", start.Add(4*time.Hour))
	laterID := insertRefund(t, pool, merchantID, txnID, 700, 17, "succeeded", end.Add(time.Hour))

	result, err := CloseBatch(context.Background(), pool, merchantID, day)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	want := money.Fils(10_000) - fee - 1_250 + 31 // 8531
	if result.NetPayoutFils != want {
		t.Errorf("NetPayoutFils = %d, want %d (10000 - fee %d - refund 1250 + fee reversed 31)", result.NetPayoutFils, want, fee)
	}
	refundFils, feeReversedFils, netFils := batchRefundTotals(t, pool, result.BatchID)
	if refundFils != 1_250 || feeReversedFils != 31 || netFils != int64(want) {
		t.Errorf("batch row refund_fils=%d fee_reversed_fils=%d net=%d, want 1250, 31, %d", refundFils, feeReversedFils, netFils, want)
	}
	if got := refundBatchID(t, pool, refundID); got == nil || *got != result.BatchID {
		t.Errorf("succeeded refund not stamped with the batch id: %v", got)
	}
	if got := refundBatchID(t, pool, failedID); got != nil {
		t.Errorf("failed refund must not be batched, got %v", got)
	}
	if got := refundBatchID(t, pool, laterID); got != nil {
		t.Errorf("refund after the business day must wait for its own batch, got %v", got)
	}
}

func TestF01d_RefundCountedOnlyOnce(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day1 := time.Date(2026, 4, 12, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	start1, _ := BusinessDayWindow(day1)
	start2, _ := BusinessDayWindow(day2)

	txnID, _ := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start1.Add(time.Hour))
	insertRefund(t, pool, merchantID, txnID, 1_000, 25, "succeeded", start1.Add(2*time.Hour))
	if _, err := CloseBatch(context.Background(), pool, merchantID, day1); err != nil {
		t.Fatalf("CloseBatch day1: %v", err)
	}

	_, fee2 := insertCaptureEvent(t, pool, merchantID, mdrBps, 4_000, start2.Add(time.Hour))
	r2, err := CloseBatch(context.Background(), pool, merchantID, day2)
	if err != nil {
		t.Fatalf("CloseBatch day2: %v", err)
	}
	if want := money.Fils(4_000) - fee2; r2.NetPayoutFils != want {
		t.Errorf("day2 NetPayoutFils = %d, want %d (day1's refund must not be taken again)", r2.NetPayoutFils, want)
	}
}

func TestF01d_RefundsBiggerThanTheDayCarryOver(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day1 := time.Date(2026, 4, 14, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	start1, _ := BusinessDayWindow(day1)
	start2, _ := BusinessDayWindow(day2)

	// Day 1: sale 5000 (fee 125); refunds 3000 (fee back 75), then 4000 (fee back 100).
	txnID, fee1 := insertCaptureEvent(t, pool, merchantID, mdrBps, 5_000, start1.Add(time.Hour))
	first := insertRefund(t, pool, merchantID, txnID, 3_000, 75, "succeeded", start1.Add(2*time.Hour))
	second := insertRefund(t, pool, merchantID, txnID, 4_000, 100, "succeeded", start1.Add(3*time.Hour))

	r1, err := CloseBatch(context.Background(), pool, merchantID, day1)
	if err != nil {
		t.Fatalf("CloseBatch day1: %v", err)
	}
	if want := money.Fils(5_000) - fee1 - 3_000 + 75; r1.NetPayoutFils != want {
		t.Errorf("day1 NetPayoutFils = %d, want %d (only the first refund fits)", r1.NetPayoutFils, want)
	}
	if r1.NetPayoutFils < 0 {
		t.Errorf("day1 net payout went below zero: %d", r1.NetPayoutFils)
	}
	if got := refundBatchID(t, pool, first); got == nil || *got != r1.BatchID {
		t.Errorf("first refund should be in day1's batch, got %v", got)
	}
	if got := refundBatchID(t, pool, second); got != nil {
		t.Errorf("second refund does not fit and must stay unbatched, got %v", got)
	}

	// Day 2: sale 10000 (fee 250) takes the carried-over 4000 refund.
	_, fee2 := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start2.Add(time.Hour))
	r2, err := CloseBatch(context.Background(), pool, merchantID, day2)
	if err != nil {
		t.Fatalf("CloseBatch day2: %v", err)
	}
	if want := money.Fils(10_000) - fee2 - 4_000 + 100; r2.NetPayoutFils != want {
		t.Errorf("day2 NetPayoutFils = %d, want %d (carried-over refund taken)", r2.NetPayoutFils, want)
	}
	if got := refundBatchID(t, pool, second); got == nil || *got != r2.BatchID {
		t.Errorf("second refund should be in day2's batch, got %v", got)
	}
}

// fix-reviewer finding: RecalculateMDR rebuilt net as gross - fee and so
// dropped the refund adjustment on a batch that holds refunds.
func TestF01d_RecalculateMDRKeepsRefundAdjustment(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	day := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)

	txnID, _ := insertCaptureEvent(t, pool, merchantID, mdrBps, 10_000, start.Add(time.Hour))
	insertRefund(t, pool, merchantID, txnID, 1_250, 31, "succeeded", start.Add(2*time.Hour))
	closed, err := CloseBatch(context.Background(), pool, merchantID, day)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}

	if _, err := pool.Exec(context.Background(), `UPDATE merchants SET mdr_bps = 300 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("raise mdr: %v", err)
	}
	if _, err := RecalculateMDR(context.Background(), pool, merchantID, day, day.AddDate(0, 0, 1)); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}

	var gross, fee, refund, feeReversed, net int64
	err = pool.QueryRow(context.Background(), `
		SELECT gross_fils, fee_fils, refund_fils, fee_reversed_fils, net_payout_fils FROM settlement_batches WHERE id = $1
	`, closed.BatchID).Scan(&gross, &fee, &refund, &feeReversed, &net)
	if err != nil {
		t.Fatalf("read batch: %v", err)
	}
	if fee == int64(closed.FeeFils) {
		t.Fatalf("fee did not change (%d); test setup is wrong", fee)
	}
	if want := gross - fee - refund + feeReversed; net != want {
		t.Errorf("net_payout_fils = %d, want %d (gross %d - fee %d - refund %d + fee reversed %d)", net, want, gross, fee, refund, feeReversed)
	}
}
