package ledger

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
)

// E56: the DB-backed test packages share one database. "go test ./..." runs
// packages in parallel, and they touched each other's rows (for example
// merchant_balances). One session-level advisory lock, held for the whole
// package run, makes the packages take turns without needing -p 1.
func TestMain(m *testing.M) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		os.Exit(m.Run())
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		os.Exit(m.Run()) // the tests report the connection problem themselves
	}
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock(hashtext('filspay-go-db-tests'))"); err != nil {
		_ = conn.Close(ctx)
		os.Exit(m.Run())
	}
	code := m.Run()
	_, _ = conn.Exec(ctx, "SELECT pg_advisory_unlock(hashtext('filspay-go-db-tests'))")
	_ = conn.Close(ctx)
	os.Exit(code)
}
