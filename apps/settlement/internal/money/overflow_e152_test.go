package money

import (
	"math"
	"testing"
)

// E152 [coverage]: ApplyRateFils must not wrap silently on int64 overflow
// (the TypeScript twin throws). Before: ApplyRateFils(1e15, 10000) gave a
// wrong value with no error.
func TestE152_ApplyRateFilsRefusesOverflow(t *testing.T) {
	for _, c := range []struct {
		amount Fils
		bps    int64
	}{{1_000_000_000_000_000, 10_000}, {math.MaxInt64, 2}, {-1_000_000_000_000_000, 10_000}} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("ApplyRateFils(%d, %d) did not refuse an overflow", c.amount, c.bps)
				}
			}()
			_ = ApplyRateFils(c.amount, c.bps)
		}()
	}
	if got := ApplyRateFils(10_000, 250); got != 250 {
		t.Fatalf("ApplyRateFils(10000, 250) = %d, want 250", got)
	}
}
