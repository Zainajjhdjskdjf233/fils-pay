# NOTES (plain words)

Each note explains one change for people who did not see the code. Same IDs as docs/NOTES.md.

## N01 — Database setup stopped halfway

When you set up the app's database from zero, it stopped in the middle with an error. Two setup steps were broken: one pointed at a table that was never created, and the next one used column names that do not exist. Because of that, 15 later steps never ran, so important tables (logins, credits, refunds and more) were missing. We removed the broken part from the first step and fixed the column names in the second. Now all 66 setup steps finish, and running setup again changes nothing.

Where: db/migrations/0054_views.sql:10, db/migrations/0055_chart_of_accounts_suspense.sql:3 · Commit: bb92a30

## N02 — The API would not start with default settings

The API needs a secret key to lock and unlock webhook secrets. If you did not give one, it used a key written in the code, but that key was the wrong length, so the API crashed on start every time. A key written in the code is also a secret that anyone can read. We removed it, so you must now always give your own key, and if you forget, the API tells you clearly that the key is not set. With a key, the API and the test data load normally.

Where: apps/api/src/config.ts:247 · Commit: da3ab76

## N03 — Login worked without the OTP code

Logging in to FilsPay is meant to need two things: your password and a one-time code. After the password step the server gives a "half-logged-in" cookie, and the code step should turn it into a real login. But the server's check never looked at whether the code step was done, so the half cookie already opened everything. Anyone with a stolen password could read the shop's payments and make a permanent API key. We added that missing check; now the half cookie is refused, and a normal login with the code still works.

Where: apps/api/src/auth/sessions.ts:92 · Commit: 35f4415

## N04 — Login could open another shop's account

Two shops in FilsPay can each have a user with the same email address. When you logged in, the server checked your password against your own shop, but then it sent the one-time code and the login to whichever user with that email it found first, in any shop. So an attacker could make a new shop using a victim's email, log in to it with their own password, and end up inside the victim's shop. We changed it so the login always goes to the user whose password was checked. A test that used to put the attacker in the victim's shop now keeps them in their own.

Where: apps/api/src/routes/auth.ts:78 · Commit: 5e9d46d

## N05 — One shop could cancel another shop's payment link

A shop can send a buyer a payment link and later cancel it. The cancel button only checked the link's number, not which shop owned it, so any shop could cancel another shop's links and stop their customers from paying. The error message even told the other shop whether a link had been paid. We made the cancel check both the link number and the shop, so another shop's link now looks like it does not exist. A test where shop A cancelled shop B's link used to succeed and now gets "not found", with B's link still working.

Where: apps/api/src/paymentLinks/cancel.ts:16 · Commit: 5710a31

## N06 — Expired payment links could still be paid (FP-187)

A payment link has an end time, like a coupon. When a buyer pressed pay, the browser told the server what time it was, and the server believed it. So anyone could send an old time and pay a link that had already expired, which is exactly ticket FP-187. We changed the server to use its own clock and ignore the time the browser sends. A test that paid an expired link with a fake 2020 time used to succeed; now it is refused and no money moves.

Where: apps/api/src/paymentLinks/pay.ts:62 · Commit: 41f2313

## N07 — Rotating an API key did not stop the old key

Shops use an API key, like a password, so their systems can talk to FilsPay. If a key leaks, an admin presses "rotate" to get a new key and kill the old one. But the rotate button only made the new key; the old, leaked key kept working. Even a test said this was fine, pointing to a "grace period" that no document describes. We made rotation kill the old key in the same step, and the old key is now refused.

Where: apps/api/src/admin/apiKeys.ts:38 · Commit: 9da617a

## N08 — Anyone could send fake messages "from the bank" (FP-240)

The bank sends FilsPay messages such as "this payment was fraud", and each message should carry a secret signature, like a wax seal on a letter. FilsPay did not require the seal by default, accepted old sealed letters again and again, and with an empty secret anyone could make a seal. So anyone on the internet could put a fake fraud note on any payment. We made the seal required, refused letters older than five minutes, and refused everything when no secret is set. Tests now show unsigned and replayed messages are refused and no note is saved.

Where: apps/api/src/webhooks/inboundVerify.ts:57 · Commit: 602aff0

## N09 — Support staff could give shops free money, and the "two people" check looked at names

FilsPay admins can give a shop a credit, and big credits need a second person to approve. But the lowest admin role, support, could create credits, and small ones were paid straight away with no second person. The "second person" check also compared names instead of people, so one admin could approve their own credit with a slightly different name. We now allow only finance and super admins to create credits, and the check compares each admin's unique id. Tests show support is refused and no credit is written.

Where: apps/api/src/routes/adminCredits.ts:66, apps/api/src/admin/creditApproval.ts:12 · Commit: 1f6c885

## N10 — "View as merchant" let senior admins act as the shop owner

FilsPay admins can open a shop's dashboard to help it, and this is meant to be look-only. But senior admins were given the shop owner's power, and finance admins the shop's finance power, so they could create payment links or redirect the shop's data, and the logs showed it as the shop's own action. The company's own audit export shows MK and AM opened shops as "owner" 16 times. We made every admin look-only while viewing a shop. A test where a finance admin created a payment link now gets refused; capture and void still need their own fix (E35).

Where: apps/api/src/admin/impersonation.ts:85 · Commit: f50a4c3

## N11 — Any shop could read the sales of another shop's sub-shops

Some shops in FilsPay have sub-shops, and the parent shop may see their sales reports. The check only asked whether the requested shop was somebody's sub-shop, not whether it belonged to the shop asking. So any shop could read another marketplace's sub-shop sales. We added "and you are its parent" to the check. A test where an outsider asked for a sub-shop's data now only gets its own data, while the real parent still sees its sub-shop.

Where: apps/api/src/reporting/scope.ts:14 · Commit: bfddbe9

## N12 — The nightly cleanup deleted every hold when nothing had expired

A hold keeps money reserved on a buyer's card until the shop takes the payment, and a nightly script removes holds that have expired. When there were no expired holds, a helper dropped the "only these holds" part, so the script deleted every hold. We kept that part even when the list is empty, so it now matches nothing. On a copy of the database, a quiet night used to delete all 4 holds; now it deletes none, and an expired hold is still removed.

Where: scripts/lib/sqlFilter.ts:10 · Commit: b3d6e94

## N13 — No refund could ever be saved

When a shop refunds a buyer, FilsPay saves a refund record that must have a reason. A database rule says the reason cannot be empty, but the code wrote an empty reason whenever the shop did not type one, so every refund crashed while saving. We now write "unspecified" when no reason is given, which is what the rule's own default was meant to do. Eleven refund tests that crashed now pass.

Where: apps/api/src/payments/processRefund.ts:190 · Commit: 397d79d

## N14 — Refunds could pay out twice, too much, or for another shop

The refund code checked the payment, asked the bank to pay, and then wrote it down as three separate steps without locking anything. So two refund clicks at the same moment could both pass and send the money back twice, a refund could be larger than what was really taken, and a shop could even refund another shop's payment. The fee given back also ignored the shop's discount. We made it one locked step, like the existing capture code, limited refunds to the captured money and the shop's own payments, and gave back exactly the fee that was paid. Tests for each of these cases failed before and pass now.

Where: apps/api/src/payments/processRefund.ts:76 · Commit: 68fd1bf

## N15 — Refunds can now be made through the API

FilsPay had the refund logic, but the refund web address only answered "not implemented". We connected it at /v1/merchants/:merchantId/refunds, allowed only owner and finance users or the shop's API key, required the shop's own safety key so a double click cannot refund twice, and checked the amount and reason. Tests show a 1.250 BD refund works, a repeat with the same key does nothing new, a support user and other shops are refused, and the refund shows in the payment's timeline.

Where: apps/api/src/routes/refunds.ts:24 · Commit: f84083a, 8f05f9e

## N16 — Shops now get a webhook when a refund succeeds

Shops get automatic messages (webhooks) when something happens to their payments, but refunds never sent one. The refund event was recorded, yet it was missing from the list of events to send, and there was no message format for it. We added the format and then the list entry. A test that made a refund used to see only the payment message; now the refund message arrives with the right amount.

Where: apps/api/src/webhooks/dispatcher.ts:31 · Commit: 079aeea

## N17 — The compose secrets file is no longer in git

A settings file with a real secret (the key that proves a message came from the card acquirer) was saved in git, even though a comment in it said it was not. A developer had trusted an AI tool that said the `.env` rule also covers `.env.docker`; it does not. We told git to stop tracking the file and to ignore it, and we added an example file with only the names. Git now shows the file as ignored. The secret is still in old history, so a person must change it.

Where: .gitignore:11 · Commit: 3145f24

## N18 — Refunds now lower the shop's payout

Each day the system pays a shop its sales minus the fee, but it forgot about refunds. So a shop that gave money back to a customer still got paid for that sale, and FilsPay lost the money. Now the daily count takes away the refunds, marks each one so it is only counted once, and moves any refund that is too big to the next day. A second reviewer also found that a fee recalculation would undo this, and we fixed that too. A real test from refund to payout leaves the shop's balance at exactly zero.

Where: apps/settlement/internal/settlement/batch.go:227 · Commit: 6ff2ffb

## N19 — Refunds now show in the reports and in reconciliation

Refunds did not appear in the daily reports, because the report worker was never told to listen for them and its half-written refund code pointed at columns that did not exist. A summary view was always empty because it matched refunds against the wrong id. The money check (reconciliation) also showed a gap whenever a refund was still waiting to be paid out. We added the missing columns, fixed the view, taught the worker and the rebuild tool about refunds, and taught reconciliation that a refund can wait a day. Tests and a live run now show the refund on the right day and a gap of zero.

Where: apps/api/src/settlement/query.ts:363 · Commit: 9afd98d

## N20 — The CSV import reads Bahraini Dinars with 3 decimals

Finance can upload a file of manual balance changes, but the system read the amounts as if money had 2 decimals like dollars. Bahraini Dinars have 3, so 4.75 BD became 0.475 BD in the books, ten times too little. We switched to the correct BD reader that already existed in the code, and fixed old tests that had been checking for the wrong numbers. Now 4.75 BD is saved as 4.750 BD, and a read-only query can find old rows that were saved wrong so finance can correct them.

Where: apps/api/src/admin/adjustmentCsvParsing.ts:8 · Commit: PENDING_N20
