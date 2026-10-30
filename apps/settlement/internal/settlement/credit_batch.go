package settlement

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/filspay/settlement/internal/money"
)

// payableAdjustmentDescriptions are the ledger lines that change what a
// merchant is owed outside captures and refunds (apps/api/src/admin:
// credits.ts, ledgerAdjustments.ts, adjustmentImport.ts).
var payableAdjustmentDescriptions = []string{
	"manual credit: base",
	"manual credit: MDR reversal",
	"manual balance adjustment",
	"CSV adjustment import",
}

// takeCredits (E121) picks the credit and adjustment groups one batch pays.
// Groups not yet taken by any batch (settlement_batch_ledger_groups) that
// happened before windowEnd are read oldest first. Credits are always taken.
// A negative adjustment is taken only while the running net stays >= 0; the
// first one that does not fit, and every later negative one, waits for the
// next batch (the same carry rule as refunds, F01d). The caller records the
// returned groups in the same transaction.
func takeCredits(ctx context.Context, tx pgx.Tx, merchantID uuid.UUID, windowEnd time.Time, netBefore money.Fils) (groups []uuid.UUID, amounts []money.Fils, creditFils money.Fils, err error) {
	rows, err := tx.Query(ctx, `
		SELECT le.entry_group_id,
		       SUM(CASE WHEN le.direction = 'credit' THEN le.amount_fils ELSE -le.amount_fils END) AS amount
		  FROM ledger_entries le
		 WHERE le.merchant_id = $1
		   AND le.account_id = 'merchant_payable'
		   AND le.description = ANY($3)
		   AND le.occurred_at < $2
		   AND NOT EXISTS (SELECT 1 FROM settlement_batch_ledger_groups g WHERE g.entry_group_id = le.entry_group_id)
		 GROUP BY le.entry_group_id
		 ORDER BY MIN(le.occurred_at), MIN(le.id)
	`, merchantID, windowEnd, payableAdjustmentDescriptions)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("settlement: CloseBatch: select unbatched credits: %w", err)
	}
	defer rows.Close()

	net := netBefore
	negativeBlocked := false
	for rows.Next() {
		var id uuid.UUID
		var amount int64
		if err := rows.Scan(&id, &amount); err != nil {
			return nil, nil, 0, fmt.Errorf("settlement: CloseBatch: scan credit: %w", err)
		}
		if amount == 0 {
			continue
		}
		if amount < 0 {
			if negativeBlocked || net+money.Fils(amount) < 0 {
				negativeBlocked = true // this one and later negative ones carry over
				continue
			}
		}
		net += money.Fils(amount)
		groups = append(groups, id)
		amounts = append(amounts, money.Fils(amount))
		creditFils += money.Fils(amount)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, 0, fmt.Errorf("settlement: CloseBatch: iterate credits: %w", err)
	}
	return groups, amounts, creditFils, nil
}
