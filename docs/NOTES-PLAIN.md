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

Where: apps/api/src/admin/adjustmentCsvParsing.ts:8 · Commit: 2f06eb4

## N21 — The daily close now starts just after Bahrain midnight

The nightly settlement was meant to start just after midnight in Bahrain, but it started around 3 AM. The timer looked at the date in UTC, which is 3 hours behind Bahrain, so for the first 3 hours after midnight it still thought it was yesterday. We now turn the time into the Bahrain date before choosing which day to close. Tests show that at 12:15 AM on 31 Oct it closes 30 Oct, as it should.

Where: apps/settlement/internal/scheduler/daemon.go:70 · Commit: 7af14ce

## N22 — The scheme file no longer rounds up

Every day we send the card network a file listing each payment, and their total was always a few fils higher than ours. The file's amount was rounded up from the full number, while our own record cut the number down. We now make the file's amount from the same cut number, so both totals match. A test shows 39.705 BD now appears as 39.70, matching our 39700 fils.

Where: apps/settlement/internal/settlement/batch.go:279 · Commit: 01eee15

## N23 — Split payouts now add up to the parent's total

When a marketplace's payout is split between its child shops, each child's part was rounded separately, so the parts could add up to more or less than the total. In one test, 3 fils were split and 4 were paid out. We now cut all parts from the same total and give any left-over fils to the children whose share was closest to the next fil. Tests show the parts always add up exactly to the total.

Where: apps/settlement/internal/splits/allocate.go:110 · Commit: 2327ed9

## N24 — The daily payout is computed in whole fils

The daily payout was calculated with a kind of decimal number that only keeps about 7 exact digits. For big shops, the result was off by a few fils. We now subtract the fee from the sales as whole fils, which is always exact. A test with a 135,000 BD day now gives the exact right payout.

Where: apps/settlement/internal/settlement/payable.go:11 · Commit: 2db05e0

## N25 — The March sweep can be run again safely

A one-time clean-up script for March doubled its effect every time it was run, because nothing remembered that it had already run. It also used UTC months, so it missed the first 3 hours of March in Bahrain. Now it checks whether each shop was already cleaned up and skips it, it cannot run twice at the same moment, and it uses Bahrain months. A test that runs it twice now sees only one clean-up.

Where: scripts/reconcile_march.ts:86 · Commit: d69061a

## N26 — The balance button and the CLI now agree

The admin site's "Recalculate cached balances" button and the command-line tool gave different balances, because they added up different records. The button only counted the payment lines sent to the card network, not fees or payouts, which is how a 135K balance became 7K. Now the button uses the same full ledger as the tool, and the tool's single-shop mode also saves its result. A test shows both now give the same number.

Where: apps/settlement/internal/internalapi/server.go:270 · Commit: b15f944

## N27 — Fee recalculation no longer changes paid batches

The tool that recalculates fees after a rate change also changed batches that had already been paid out, which should never happen. It picked every batch that was "not open", and that included "paid" ones. Now it only picks batches that are closed but not yet paid. A test shows a paid batch stays exactly the same while an unpaid one is still updated.

Where: apps/settlement/internal/settlement/recalculate_mdr.go:67 · Commit: 23e2f73

## N28 — The admin status tool no longer turns test shops live

The group chat said test shops kept showing up in the real settlement run, and it was true. An admin tool for tidying payment statuses also switched test shops to live, because it used a count that was always zero. Live shops get paid for real, so this could send real money for fake sales. Now the tool only tidies statuses and never touches the test flag, and a test confirms a test shop stays a test shop.

Where: apps/api/src/routes/adminMerchantsRecompute.ts:31 · Commit: 41c17e8

## N29 — One payment link can only be paid once, even when payment is slow

In May, two customers were charged for the same payment link. When a payment was slow, the link's "reserved" mark expired and a second buyer could pay as well, and both were told "paid". Now each reservation has its own secret token, and the link is locked in the database until the payment is finished, so a second buyer is told to wait. Our tests make two buyers pay at the same moment, and with a slow payment, and now only one is ever charged.

Where: apps/api/src/paymentLinks/pay.ts:144 · Commit: ad472fc

## N30 — A paid batch is announced and paid out only once

In August, shops got two "you have been paid" messages for one payout, because two programs checked at the same moment and both thought they were first. We also found that the bank payout instruction was written once per webhook address, so a shop with two addresses could get two instructions. Now both steps take a database lock, so only one program works at a time and each batch is handled once. Tests that run two programs at once now see exactly one message and one instruction per batch.

Where: apps/settlement/internal/settlement/payout_notify.go:40 · Commit: 8d56ba7

## N31 — The dashboard shows the fee that is really charged

Finance saw a 2.45% fee on the dashboard while payments were charged 2.25%. The dashboard picked the fee row that was typed in last, even if it was a correction for an old period, while payments used the row that is currently in effect. Now both use the same rule, and the settlement program uses the same tie-break too. A test with the exact case-file numbers now shows 2.25% on both.

Where: apps/api/src/fees/currentFeeScheduleDisplay.ts:39 · Commit: 5b2599c

## N32 — The same correction file cannot be applied twice

Finance's balance-correction upload had no protection against uploading the same file twice, so every correction could be counted double. A code comment claimed the filename blocked it, but it did not. Now each upload is fingerprinted by its contents, and the database refuses a second upload with the same fingerprint. A test shows the second upload is rejected and the money is posted only once.

Where: apps/api/src/admin/adjustmentImport.ts:65 · Commit: c32a3d4

## N33 — Two money counters now use big whole numbers

Two running totals were stored in number types that were too small. The shop's lifetime payout total drifted because it used rough decimals, and the platform's total volume would flip to a large negative number just after passing 2 million BD, which would also switch off a fee discount for every shop. We changed both to large whole numbers. Tests now give the exact totals and no negative value.

Where: apps/settlement/internal/settlement/platform_volume.go:26 · Commit: effaf33

## N34 — The same bank message is saved only once

When the bank sent the same fraud-check message twice, the system saved two identical notes on the payment. A past release said this was fixed, but the code never changed. Now each message is saved only if it has not been saved before, with a lock so two copies arriving together cannot both get in. A test sending three copies now finds one note.

Where: apps/api/src/acquirer/callbacks.ts:50 · Commit: 8fd0c90

## N35 — The settlement summary no longer counts part-payments twice

When a payment was collected in two parts, the settlement summary counted the full payment once for each part, so 10 BD showed as 20 BD. We now add up the amount of each part instead. A test that collects 4 BD and then 6 BD now shows 10 BD.

Where: apps/api/src/settlement/query.ts:408 · Commit: 0be550a

## N36 — Webhooks now send exactly what they sign

Shops reported that FilsPay's webhook signatures never matched. FilsPay computed the signature over the message with its fields sorted, but sent the message with the fields in a different order, so the shop's check always failed. Now the message is sent exactly as it was signed. A test that checks the signature the way a shop would now passes.

Where: apps/api/src/webhooks/dispatcher.ts:176 · Commit: 8c76fb8

## N37 — Login codes and secret links now use secure randomness

The one-time login codes, payment-link addresses and admin invite codes were made with a random generator that is not meant for secrets and can be predicted. A comment said a secure one was used, but it was not. We switched all three to the secure random generator from Node's crypto library. A test proves the codes no longer depend on the old generator.

Where: apps/api/src/lib/random.ts:10 · Commit: 971474c

## N38 — Five wrong login codes really means five

The login code allowed only 5 wrong tries, but sending many guesses at the same moment got around it: 48 out of 50 were checked. Asking for a new code also reset the count. Now the database hands out each try before the guess is checked, and never more than 5, and a new code keeps the old count. The reviewer also made sure a double-click on the right code does not log the user out again.

Where: apps/api/src/routes/auth.ts: · Commit: 31b2741

## N39 — Only owners and finance can capture or void payments

Any shop user, even a support assistant, could take the money for a payment or cancel it, because those two actions had no role check. We now allow them only for the owner and finance roles. A test shows a support user is refused and a finance user still works.

Where: apps/api/src/routes/transactions.ts:98 · Commit: 2b3c0c7

## N40 — Webhook addresses can no longer point inside our network

A shop could give an internal address as its webhook URL, and our server would send requests there and even show part of the answer, which could leak secrets from inside our network. We now refuse private and local addresses in production, check where a name really points just before sending, never follow redirects, and read only a small part of the answer. The reviewer found one tricky address form I had missed; it is now blocked too.

Where: apps/api/src/webhooks/ssrfGuard.ts:9 · Commit: fb51fca

## N41 — Login codes are no longer shown unless a developer asks

A testing shortcut sent the one-time login code back in the login answer and wrote it to the log, and it was switched on by default unless the server was marked as "production". The hosted setup never marked it, so anyone with a password also got the code. Now the shortcut is off unless a developer turns it on on purpose. A test shows it is off when nothing is set.

Where: apps/api/src/config.ts:212 · Commit: f588a09

## N42 — The CSV export is safe to open and cannot eat all memory

The payment export could carry a spreadsheet formula hidden in a payment reference, which Excel would run when the shop opened the file. It also loaded every row into memory, so a very large export could crash the server. Now such cells are marked as plain text, and an export above 50,000 rows asks the user to choose a shorter date range. Tests check both.

Where: apps/api/src/transactions/exportCsv.ts: · Commit: 3918ae8

## N43 — The report worker no longer crashes on an empty day

The report worker checked each closed settlement day against its own daily summary, and crashed if that summary did not exist yet. Because a crash makes it retry the same work, it got stuck forever and all reports stopped updating. Now a missing summary simply counts as zero and the worker writes a warning. A test with exactly that situation now passes.

Where: apps/reporting/src/consumer/applyEvent.ts:149 · Commit: 44adee8

## N44 — One bad event no longer stops all reports

The report worker processed events in order, and one broken event made it fail and retry the same event forever, so all reports stopped. Now each event is handled on its own: a broken one is set aside in a "dead letters" table with its error, and the worker moves on. Real database problems still stop it, so nothing good is set aside by mistake. Four tests that always failed before now pass.

Where: apps/reporting/src/consumer/runConsumerPass.ts:63 · Commit: 41c9754

## N45 — The report worker can no longer skip a slow payment's event

The report worker kept a bookmark of the last event it had read, but event numbers are handed out when saving starts, not when it ends. A slow payment could finish after a faster one with a higher number, and the bookmark had already moved past it, so it was never counted. Now the worker only reads events from transactions that have certainly finished, in a safe order. A test with a slow and a fast payment now counts both.

Where: apps/reporting/src/consumer/runConsumerPass.ts:54 · Commit: eebf7d4

## N46 — Reconciliation predicts the fee the way settlement charges it

The money check guessed the fee on payments not yet paid out using the shop's default rate and rough decimals, while payments were really charged a scheduled rate. So the check almost never balanced. Now it uses the exact same rule and rounding as the real settlement. A test that used to show a 66-fils gap now shows zero.

Where: apps/api/src/settlement/query.ts:374 · Commit: 976d166

## N47 — A payout on the next day is no longer a mystery gap

Each day's batch is paid out the next day, and the money check counted that payout as if it were the next day's own activity. So the day after every payout looked like money was missing. Now the check leaves payout lines out and compares only real activity with the batches. A test over three different date ranges now always balances.

Where: apps/api/src/settlement/query.ts:314 · Commit: ad4a77b

## N48 — Checked: two login cookies never mix identities

A code comment warned that a shop login and an admin "view as shop" login in the same browser could mix two identities. We wrote a test that sends both at once, and the app always used exactly one identity, as it should. So this was not a real bug. The test stays to make sure it never becomes one.

Where: apps/api/src/auth/requireMerchantAuth.e58.test.ts · Commit: d69c07f

## N49 — Fee recalculation no longer charges back the volume discount

When the platform is big enough, shops get a small fee discount, and the daily close applies it. The fee recalculation tool did not know about the discount or the shop's scheduled rate, so even with no rate change it raised fees. Now each day's batch remembers the discount it got, and the tool uses the same rate rules as the daily close. A test shows a recalculation with no rate change now changes nothing.

Where: apps/settlement/internal/settlement/recalculate_mdr.go:169 · Commit: 376bc49

## N50 — The settlement summary reads only the days it needs

The settlement summary page was slow for big shops because the database read every payment event ever stored, not just the month asked for. We added an index, which lets the database jump straight to the right days. On a copy with about 400,000 events it went from 66 to 52 milliseconds, and it will no longer slow down as history grows. The same copy also confirmed the earlier triple-counting bug at full size.

Where: db/migrations/0081_transaction_events_capture_time_idx.sql:7 · Commit: fffaa6c

## N51 — Payment links now get the shop's negotiated discount

Shops with a negotiated fee discount got it when customers paid by card through the API, but not when customers used a payment link, so those shops paid too much. A comment claimed both were covered, but only one was. Now the payment link uses the same discount step. A test shows the same fee both ways.

Where: apps/api/src/paymentLinks/pay.ts:228 · Commit: 107618c

## N52 — Shops can refund from the dashboard

The refund screen in the shop dashboard had been built but switched off, and it had problems: showing a refund in the payment history would crash the page, and retrying after a network problem could refund twice. We switched it on, fixed the money display for negative amounts, made retries safe, and show how much can still be refunded. Tests check the rules, and the API now tells the page how much was already refunded.

Where: apps/web/src/pages/transactions/RefundDrawer.tsx · Commit: e5eb890

## N53 — The dashboard and admin console can reach the API

The shop dashboard and the admin website ran on their own web addresses and called the API on another one, which browsers block unless the API allows it, and it did not. So neither website could actually work. Instead of opening the API to other addresses, we made both websites call the API through their own address, which is safer. A live test of signup, login and the login code through the dashboard address now works.

Where: apps/web/vite.config.ts:12 · Commit: e5eb890

## N54 — The daily close now books the rounding leftovers

The card network's file only has room for two decimals, so each payment line loses a few fils. The design said those fils are written into a special "leftovers" account every day, but the code never did it, so the books never matched the network's statement. Now the daily close writes them down for every line. A test shows a 4.755 BD payment puts exactly 5 fils into the leftovers account.

Where: apps/settlement/internal/settlement/batch.go:289 · Commit: 184c0b2

## N55 — The shop dashboard no longer logs out after 10 minutes

Shop users were silently logged out 10 minutes after logging in, and every page then just showed an error. The login cookie was set for 10 minutes (enough to type the code) and never renewed after the code was accepted, even though the server kept the session for 12 hours. Now the cookie is renewed for 12 hours, and if the session ever ends, the dashboard shows the login page. A test checks the new 12-hour cookie.

Where: apps/api/src/routes/auth.ts:217 · Commit: 0d04c29

## N56 — Bulk KYC approval approves only merchants under review

Admins can approve the identity checks of many shops at once. The list kept shops selected after the filter changed, and the server approved whatever it was sent, even shops that had been rejected. Now the server only approves shops that are waiting for review, and the list forgets its selection when the filter changes. A test shows a rejected shop stays rejected.

Where: apps/api/src/admin/bulkKyc.ts:30 · Commit: 850275f

## N57 — Retrying a capture or refund can no longer take money twice

Each money action carries a ticket number so the server can spot a repeat. The capture button made a new ticket on every click, so retrying after a lost answer could take the money twice, and my refund screen kept an old ticket even after a clear refusal. Now both keep the ticket only when no clear answer came back, and use a new one after a clear refusal. A test checks the rule for each kind of error.

Where: apps/web/src/api/idempotencyKey.ts:11 · Commit: 0cf9a60

## N58 — The whole app now runs in Docker, inside the hosting limits

The instructions said to start the app with Docker, but the files it needed were missing, the database password was in plain sight, and the database was open to the internet. We wrote the missing files and set each part's CPU and memory so the whole app fits the competition's small server. Parts restart by themselves after a crash, data is kept on disk, and only the website is reachable from outside. We crashed the database and the API on purpose and both came back with no data lost.

Where: ops/docker-compose.yml · Commit: d7d17b2

## N59 — Too many buyers at once get "busy, retry" instead of a crash, and we know our capacity

When too many buyers paid at the same moment, the server used to let them all queue, so everyone waited longer and longer. Now it serves as many as it can quickly and tells the rest "busy, try again in a second". We tested it with a load-testing tool: it handles about 15 checkouts per second on the competition's small server size, survives three times that load without crashing, and goes straight back to normal afterwards. After about 11,000 test payments, no buyer was charged twice and the books balanced exactly.

Where: apps/api/src/plugins/loadShedding.ts:42 · Commit: a8fdcb1

## N60 — Logging in again no longer gives an attacker fresh guesses

The login code allowed only 5 wrong guesses, but each new login gave 5 new guesses, and old codes stayed valid. Someone who knew the password could keep trying until they hit the right code. Now the guesses are counted per person across all logins (10 per 15 minutes), and each new login cancels the older codes. Tests show the old code stops working and the account is locked after too many guesses.

Where: apps/api/src/auth/otp.ts:71 · Commit: a3975a9

## N61 — A day can only be closed after it has ended

An admin could close today's settlement in the middle of the day, and every payment after that moment was never paid out to the shop, with no warning. Now the system refuses to close a day until Bahrain midnight has passed. A test shows today is refused and yesterday still closes normally.

Where: apps/settlement/internal/settlement/batch.go:67 · Commit: fb945fa

## N62 — One admin can no longer move big money through the CSV import

Credits over 50 BD normally need a second person to approve them, but the balance-correction file upload let one admin post any amount, even a million BD. Now an upload is refused if any line, or all lines together, go over 50 BD; bigger corrections must use the two-person credit process. A test shows the million-BD file is refused and nothing is posted.

Where: apps/api/src/admin/adjustmentImport.ts:65 · Commit: c973988

## N63 — A busy database no longer freezes all payment-link payments

Only two link payments may hold a link lock at once, each with a "ticket". When the database was too busy to give a connection, the payment failed but never gave its ticket back. After two such failures, every later link payment waited forever. Now a failed connection returns the ticket, frees the link and cancels the card hold. A test with one ticket shows the next payment goes through instead of hanging.

Where: apps/api/src/paymentLinks/pay.ts:141 · Commit: c06b7eb

## N64 — A broken card form gives a clear 400, not a crash that blocks the link

When someone sent a card with missing parts, the server crashed after it had already reserved the payment link. The buyer saw an error, and the link stayed "busy" for a minute so the real buyer could not pay. Now both payment routes check the card first and answer "bad card" (400) before touching anything. Card numbers typed with spaces still work. A test sends seven broken cards to both routes and then pays normally.

Where: apps/api/src/routes/paymentLinks.ts:163 · Commit: 93d09b2

## N65 — Each card capture gets its own discount, exactly once

Shops with a negotiated discount get part of our fee back after each capture. The old code always used the newest capture's fee, so when one refund-of-fee was missed, the next ones were the wrong size. In one case (a tiny first capture) a repeated request paid the discount twice. Now every capture's discount is worked out from its own fee and only the missing ones are written. Two tests show the wrong amounts before and the right ones after.

Where: apps/api/src/payments/discountAdjustment.ts:70 · Commit: 1d456a8

## N66 — A fee recalculation can no longer make a payout negative

Admins can recalculate fees on batches that are closed but not yet paid. The code took the extra fee straight off the payout, even when refunds had already used almost all of it, so a payout could become negative. Now such a batch is left as it is and shown to the admin as "skipped" for a human decision. A test shows a 50-fils payout no longer turns into minus 1,700 fils.

Where: apps/settlement/internal/settlement/recalculate_mdr.go:118 · Commit: cc6d252

## N67 — Money an admin credits to a shop is now really paid out

When an admin gave a shop a credit or a correction, it changed the shop's balance, but the daily payout never included it, so the shop was never paid that money (and negative corrections were never taken back). Now the daily close adds unpaid credits to the payout and remembers them in a small table so each one is paid exactly once. A negative correction waits for a day with enough money, so a payout never goes below zero. Tests show the payout and the reconciliation are now right.

Where: apps/settlement/internal/settlement/batch.go:238 · Commit: d97de16

## N68 — The export summary now needs a login

One report address forgot to check who was calling, so anyone could reach it without logging in. It only failed with an error because it looked for a user who was not there, and a quick fix of that error would have shown shop data to strangers. We added the same login check the other reports use. A test shows a stranger now gets "not logged in" (401) and a real shop gets its own numbers.

Where: apps/api/src/routes/reporting.ts:80 · Commit: 26856d3

## N69 — Report filters are checked before they reach the database

The transactions report takes a filter (shop, status, dates) as text. The server used it without checking, so strange values like "null" or an impossible date crashed it. Now it checks the filter first and answers "bad filter" (400). A test sends twelve bad filters and four good ones.

Where: apps/api/src/routes/reporting.ts:35 · Commit: 383d417

## N70 — Checkout fits on a phone; amounts line up in tables

On the payment page, the expiry and CVV boxes were wider than the form, so on a phone the CVV box went off the screen and the month box was tiny. We made the three boxes share the row equally, so they fit on any screen. In the dashboard and admin tables, digits now all have the same width, so amounts line up. Before and after screenshots of 13 screens are in docs/ui.

Where: apps/web/src/pages/checkout/CheckoutPage.css:44 · Commit: b22520f

## N71 — Two reporting runs can no longer count a payment twice

The reporting worker keeps a bookmark of how far it has read. When two runs started at the same moment, both read the same bookmark and both added the same payments, so totals doubled. Now the bookmark is locked while one run works, and the other waits its turn. A test runs two at once and shows each payment counted once.

Where: apps/reporting/src/consumer/cursor.ts:40 · Commit: 8720dd6

## N72 — Paid batches now show as "paid" in payout trends

When a shop was paid, the system sent a "paid" message, but the reporting part never listened for it, so the dashboard showed every batch as only "closed". Now the reporting worker reads that message and marks the batch as paid. A test closes a batch, pays it, and checks the dashboard data says "paid".

Where: apps/reporting/src/consumer/applyEvent.ts:187 · Commit: d4df731
