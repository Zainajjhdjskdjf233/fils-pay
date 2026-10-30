package settlement

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// E15: net payout must be exact integer fils (ADR-0001), never float32.
func TestE15_NetPayableIsExactForBigBatches(t *testing.T) {
	cases := []struct{ gross, fee, want int64 }{
		{135_000_123, 3_375_003, 131_625_120},
		{16_777_217, 0, 16_777_217}, // first integer float32 cannot hold
		{10_000, 250, 9_750},
	}
	for _, c := range cases {
		if got := NetPayableFils(money.Fils(c.gross), money.Fils(c.fee)); int64(got) != c.want {
			t.Errorf("NetPayableFils(%d, %d) = %d, want %d", c.gross, c.fee, got, c.want)
		}
	}
}
