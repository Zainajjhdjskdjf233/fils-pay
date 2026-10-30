// Package money is the Go port of packages/money/src/fils.ts's integer-fils
// arithmetic, matching its rounding exactly. int64 covers
// amount*rateBasisPoints at any realistic scale, so there are no bigint
// intermediates here.
package money

import (
	"fmt"
	"math"
)

// Fils is a validated integer number of fils. 1 BD = 1000 fils.
type Fils int64

// ApplyRateFils applies a rate expressed in basis points to an amount, e.g.
// ApplyRateFils(10000, 250) applies a 2.50% MDR to 10.000 BD and returns
// 250. Uses BankersRoundDiv for deterministic half-to-even rounding.
//
// E152: panics on int64 overflow instead of wrapping to a wrong fee. Money
// paths that run inside the daemon use ApplyRateFilsChecked, which returns
// an error instead (a panic there would crash-loop the daemon).
func ApplyRateFils(amount Fils, rateBasisPoints int64) Fils {
	fee, err := ApplyRateFilsChecked(amount, rateBasisPoints)
	if err != nil {
		panic(err.Error())
	}
	return fee
}

// ApplyRateFilsChecked is ApplyRateFils that returns an error when
// amount*rateBasisPoints overflows int64 (E152; packages/money throws).
func ApplyRateFilsChecked(amount Fils, rateBasisPoints int64) (Fils, error) {
	a := int64(amount)
	product := a * rateBasisPoints
	if a != 0 && (product/a != rateBasisPoints || (a == -1 && rateBasisPoints == math.MinInt64)) {
		return 0, fmt.Errorf("ApplyRateFils: %d * %d overflows int64", a, rateBasisPoints)
	}
	return Fils(BankersRoundDiv(product, 10_000)), nil
}

// BankersRoundDiv performs round-half-to-even integer division of
// numerator/denominator, matching packages/money/src/fils.ts's
// bankersRoundDiv's tie-breaking rule exactly, so Go and TypeScript never
// disagree about a shared rounding decision.
func BankersRoundDiv(numerator, denominator int64) int64 {
	if denominator == 0 {
		panic("BankersRoundDiv: denominator must not be zero")
	}
	negative := (numerator < 0) != (denominator < 0)
	absNum, absDen := abs64(numerator), abs64(denominator)
	quotient, remainder := absNum/absDen, absNum%absDen
	twiceRemainder := remainder * 2

	var rounded int64
	switch {
	case twiceRemainder < absDen:
		rounded = quotient
	case twiceRemainder > absDen:
		rounded = quotient + 1
	default: // exact tie: round to even
		if quotient%2 == 0 {
			rounded = quotient
		} else {
			rounded = quotient + 1
		}
	}
	if negative {
		return -rounded
	}
	return rounded
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

// String satisfies fmt.Stringer for readable test failure output and log
// lines (fils integer, no unit conversion — never used for money display,
// which has no requirement in apps/settlement).
func (f Fils) String() string {
	return fmt.Sprintf("%dfils", int64(f))
}
