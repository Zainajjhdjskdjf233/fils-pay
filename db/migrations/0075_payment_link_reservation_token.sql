-- E29 (incident 2026-05-14): each pay attempt's claim gets its own token.
-- Finalize/release/refresh require the token, so a request whose stale
-- reservation was re-claimed by a second buyer can no longer act as owner.
ALTER TABLE payment_links ADD COLUMN reservation_token UUID;
