package internalapi

import (
	"net/http"
	"testing"
	"time"
)

// E118: the internal run-batch endpoint (behind the admin button) refuses today.
func TestE118_RunBatchRefusesToday(t *testing.T) {
	pool := mustPool(t)
	server := newTestServer(t, pool)
	today := time.Now().UTC().Add(3 * time.Hour).Format("2006-01-02") // Bahrain date
	resp := post(t, server, "/internal/run-batch", "Bearer "+testToken, `{"date":"`+today+`"}`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for a business day that has not ended", resp.StatusCode)
	}
}
