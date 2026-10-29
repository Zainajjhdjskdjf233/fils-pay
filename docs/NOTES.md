# NOTES

Questions and answers for each change. Same IDs as docs/NOTES-PLAIN.md.

## N01 — Database setup stopped halfway

What did we see?
   Setting up a new database failed with "relation settlement_batch_events does not exist" and only 51 of 66 migrations ran.

Why?
   Migration 0054 made a view on a table no migration creates, and 0055 used column names the accounts table never had.

What did it break?
   No fresh install could get the tables for sessions, credits, CSV imports, webhook archives or refunds, so the app could not work.

What did we change?
   We removed the one broken view in db/migrations/0054_views.sql:10 and used the real columns in db/migrations/0055_chart_of_accounts_suspense.sql:3.

How do we know it works?
   check-migrate.sh: before 51 of 66 applied, after 66 of 66 applied.

## N02 — The API would not start with default settings

What did we see?
   Starting the API or the seed stopped at once with "must base64-decode to exactly 32 bytes, got 34".

Why?
   When no key was set the code used a built-in key that is 34 bytes long, but its own check needs exactly 32.

What did it break?
   Nobody could start the API or load the test data without knowing to set a key, and a public key was written in the source.

What did we change?
   We removed the built-in key so the key must always be set, in apps/api/src/config.ts:247.

How do we know it works?
   config.e51.test.ts: before 2 of 3 tests failed, after 3 of 3 pass.
