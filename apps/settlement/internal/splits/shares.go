package splits

import (
	"math/big"
	"sort"

	"github.com/filspay/settlement/internal/money"
)

// ChildWeight is one sub-merchant's configured share of a parent's payout.
type ChildWeight struct {
	WeightBps int64
}

// ChildShares distributes netPayout across children by their weights.
//
// E17: largest-remainder allocation, so the shares always sum to exactly
// netPayout (rounding each share on its own lost or invented fils). Each
// child first gets floor(net * w / W); the fils left over go one each to
// the children with the largest remainders (ties: earlier child first).
// W is the children's own weight total, so weights that do not total
// 10000 are split proportionally instead of losing fils (Decision for
// Zainab to review). Integer math only (math/big avoids overflow).
func ChildShares(netPayout money.Fils, children []ChildWeight) []money.Fils {
	out := make([]money.Fils, len(children))
	var total int64
	for _, c := range children {
		total += c.WeightBps
	}
	if len(children) == 0 || total <= 0 || netPayout <= 0 {
		return out
	}

	net := big.NewInt(int64(netPayout))
	w := big.NewInt(total)
	remainders := make([]int64, len(children))
	var allocated int64
	for i, c := range children {
		q, r := new(big.Int).QuoRem(new(big.Int).Mul(net, big.NewInt(c.WeightBps)), w, new(big.Int))
		out[i] = money.Fils(q.Int64())
		remainders[i] = r.Int64()
		allocated += q.Int64()
	}

	order := make([]int, len(children))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool { return remainders[order[a]] > remainders[order[b]] })
	for k := int64(0); k < int64(netPayout)-allocated; k++ {
		out[order[k]]++
	}
	return out
}
