package settlement

import (
	"github.com/filspay/settlement/internal/money"
)

// NetPayableFils derives the net payout from frozen gross and fee totals.
// E15: plain integer fils (ADR-0001). It went through float32, which has
// about 7 significant digits, so big batches gained or lost fils.
func NetPayableFils(grossFils, feeFils money.Fils) money.Fils {
	return grossFils - feeFils
}
