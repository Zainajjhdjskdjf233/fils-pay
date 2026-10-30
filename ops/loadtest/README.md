# Checkout load test (k6)

Measures how many checkouts per second the stack serves while staying fast
(p95 < 2 s) and correct, and checks that it turns away excess load (503) and
recovers. Results and method: docs/LOG.md section 6, "Capacity estimate".

1. Start the stack: `docker compose --env-file ops/.env.docker -f ops/docker-compose.yml up -d --build`
2. Test data (a load-test shop and 60,000 single-use links `lt-1` … `lt-60000`) —
   only on a test stack:
   ```sh
   docker compose --env-file ops/.env.docker -f ops/docker-compose.yml exec -T postgres psql -U postgres -d filspay <<'SQL'
   SET ROLE filspay_owner;
   INSERT INTO merchants (id, display_name, mdr_bps, status, onboarding_status, kyc_passed, test_mode)
   VALUES ('00000000-0000-4000-8000-00000000c0de', 'Load Test Shop', 250, 'active', 'approved', true, false)
   ON CONFLICT (id) DO NOTHING;
   INSERT INTO payment_links (merchant_id, token, amount_fils, reference, description, expires_at, created_by_type, created_by_id)
   SELECT '00000000-0000-4000-8000-00000000c0de', 'lt-' || g, 4750, 'load-' || g, 'Load test order', now() + interval '2 days',
          'merchant_api_key', '00000000-0000-4000-8000-00000000c0de'
     FROM generate_series(1, 60000) g ON CONFLICT (token) DO NOTHING;
   SQL
   ```
3. Run a step (open model, RATE checkouts per second):
   `k6 run -e BASE=http://localhost:8080 -e RATE=15 -e DURATION=40s -e OFFSET=0 ops/loadtest/checkout.js`
   Closed model (N users back to back): add `-e VUS=15`.
   Raise OFFSET between runs so each run uses fresh links (each link can be paid once).
4. Read `checkout_paid`, `checkout_shed` (503 = turned away on purpose),
   `checkout_error` (≈ 4 % are the acquirer simulator's planned declines), and
   `checkout_pay_ms` p95.
