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
