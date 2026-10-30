package settlement

import (
	"context"
	"errors"
	"testing"
	"time"
)

// E118 [deep review]: a business day may only be closed after it has ended
// (Asia/Bahrain). Closing "today" early stranded every later capture of the
// day: the batch was no longer open and later windows never include them.
func TestE118_CannotCloseADayThatHasNotEnded(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	today := BusinessDateOf(time.Now())
	for _, d := range []time.Time{today, today.AddDate(0, 0, 3)} {
		_, err := CloseBatch(context.Background(), pool, merchantID, d)
		if !errors.Is(err, ErrBusinessDayNotOver) {
			t.Errorf("CloseBatch(%s) err = %v, want ErrBusinessDayNotOver", d.Format("2006-01-02"), err)
		}
	}
	if n := countRows(t, pool, `SELECT COUNT(*) FROM settlement_batches WHERE merchant_id = $1`, merchantID); n != 0 {
		t.Errorf("%d batch rows created for days that have not ended", n)
	}
	if _, err := CloseBatch(context.Background(), pool, merchantID, today.AddDate(0, 0, -1)); err != nil {
		t.Errorf("yesterday must still close: %v", err)
	}
}
