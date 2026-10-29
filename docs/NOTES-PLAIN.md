# NOTES (plain words)

Each note explains one change for people who did not see the code. Same IDs as docs/NOTES.md.

## N01 — Database setup stopped halfway

When you set up the app's database from zero, it stopped in the middle with an error. Two setup steps were broken: one pointed at a table that was never created, and the next one used column names that do not exist. Because of that, 15 later steps never ran, so important tables (logins, credits, refunds and more) were missing. We removed the broken part from the first step and fixed the column names in the second. Now all 66 setup steps finish, and running setup again changes nothing.

Where: db/migrations/0054_views.sql:10, db/migrations/0055_chart_of_accounts_suspense.sql:3 · Commit: bb92a30

## N02 — The API would not start with default settings

The API needs a secret key to lock and unlock webhook secrets. If you did not give one, it used a key written in the code, but that key was the wrong length, so the API crashed on start every time. A key written in the code is also a secret that anyone can read. We removed it, so you must now always give your own key, and if you forget, the API tells you clearly that the key is not set. With a key, the API and the test data load normally.

Where: apps/api/src/config.ts:247 · Commit: da3ab76
