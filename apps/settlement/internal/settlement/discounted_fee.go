package settlement

import "github.com/filspay/settlement/internal/money"

// ComputeSettlementFee computes the platform fee owed on one capture event,
// net of any negotiated per-merchant discount.
// E152: returns an error on int64 overflow instead of a wrong fee or a panic.
func ComputeSettlementFee(amountFils money.Fils, mdrBasisPoints, discountBasisPoints int64) (money.Fils, error) {
	discount, err := money.ApplyRateFilsChecked(amountFils, discountBasisPoints)
	if err != nil {
		return 0, err
	}
	return money.ApplyRateFilsChecked(amountFils-discount, mdrBasisPoints)
}
