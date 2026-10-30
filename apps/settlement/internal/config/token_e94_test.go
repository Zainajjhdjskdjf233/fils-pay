package config

import "testing"

// E94: the daemon must refuse a weak internal token ("dev-token" is what the
// docs show), not only an empty one. ops/gen-env.sh writes 64 hex characters.
func TestE94_RequireInternalTokenRefusesShortTokens(t *testing.T) {
	for _, tok := range []string{"", "dev-token", "short-but-not-empty-123"} {
		if err := (Config{InternalToken: tok}).RequireInternalToken(); err == nil {
			t.Errorf("token %q was accepted", tok)
		}
	}
	if err := (Config{InternalToken: "0123456789abcdef0123456789abcdef"}).RequireInternalToken(); err != nil {
		t.Errorf("a 32-character token was refused: %v", err)
	}
}
