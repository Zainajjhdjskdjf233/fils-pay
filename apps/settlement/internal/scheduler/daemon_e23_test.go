package scheduler

import (
	"testing"
	"time"
)

// E23: the daily close must start runDelayMinutes after Bahrain midnight
// (UTC+3), not after UTC midnight (03:00 Bahrain).

func ymd(t time.Time) string { return t.Format("2006-01-02") }

func TestE23_dueRightAfterBahrainMidnight(t *testing.T) {
	now := time.Date(2026, 10, 30, 21, 15, 0, 0, time.UTC) // 00:15 on 31 Oct in Bahrain
	date, due := dueBusinessDate(now, 10)
	if !due || ymd(date) != "2026-10-30" {
		t.Fatalf("at 00:15 Bahrain on 31 Oct: got (%s, due=%v), want (2026-10-30, due=true)", ymd(date), due)
	}
}

func TestE23_notDueInsideTheGracePeriod(t *testing.T) {
	now := time.Date(2026, 10, 30, 21, 5, 0, 0, time.UTC) // 00:05 on 31 Oct in Bahrain
	if _, due := dueBusinessDate(now, 10); due {
		t.Fatalf("at 00:05 Bahrain with a 10 minute delay nothing new may be due")
	}
}

func TestE23_lateEveningStillClosesYesterday(t *testing.T) {
	now := time.Date(2026, 10, 30, 20, 0, 0, 0, time.UTC) // 23:00 on 30 Oct in Bahrain
	date, due := dueBusinessDate(now, 10)
	if !due || ymd(date) != "2026-10-29" {
		t.Fatalf("at 23:00 Bahrain on 30 Oct: got (%s, due=%v), want (2026-10-29, due=true)", ymd(date), due)
	}
}
