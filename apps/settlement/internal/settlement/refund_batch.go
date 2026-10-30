package settlement

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/filspay/settlement/internal/money"
)

// takeRefunds (F01d) picks the refunds one batch absorbs. It locks the
// merchant's unbatched succeeded refunds that happened before windowEnd,
// oldest first, and takes them while the running net stays >= 0. The first
// refund that would push the net below zero, and every later one, is left
// unbatched for the next day's batch, so no fils are lost and no payout is
// negative. The caller stamps the returned ids with the batch id in the same
// transaction.
func takeRefunds(ctx context.Context, tx pgx.Tx, merchantID uuid.UUID, windowEnd time.Time, netBefore money.Fils) (ids []uuid.UUID, refundFils, feeReversedFils money.Fils, err error) {
	rows, err := tx.Query(ctx, `
		SELECT id, amount_fils, fee_reversed_fils
		  FROM refunds
		 WHERE merchant_id = $1
		   AND settlement_batch_id IS NULL
		   AND status = 'succeeded'
		   AND occurred_at < $2
		 ORDER BY occurred_at, id
		 FOR UPDATE
	`, merchantID, windowEnd)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("settlement: CloseBatch: select unbatched refunds: %w", err)
	}
	defer rows.Close()

	net := netBefore
	for rows.Next() {
		var id uuid.UUID
		var amount, feeReversed int64
		if err := rows.Scan(&id, &amount, &feeReversed); err != nil {
			return nil, 0, 0, fmt.Errorf("settlement: CloseBatch: scan refund: %w", err)
		}
		after := net - money.Fils(amount) + money.Fils(feeReversed)
		if after < 0 {
			break // this one and later ones carry over to the next batch
		}
		net = after
		ids = append(ids, id)
		refundFils += money.Fils(amount)
		feeReversedFils += money.Fils(feeReversed)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, 0, fmt.Errorf("settlement: CloseBatch: iterate refunds: %w", err)
	}
	return ids, refundFils, feeReversedFils, nil
}
