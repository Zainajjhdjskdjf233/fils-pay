# Live demo — 90 seconds

Site: **http://139.59.57.26** (dashboard and checkout on port 80; admin console on port 8081).
Prepared on 30 Oct 2026 at 9:20 PM through the public API (the same calls the dashboard makes), and rehearsed once on a second, identical set (LOG.md section 6).

## Before you start

- **Merchant ID:** `b84b79da-a262-4c15-a553-2286b019dd12`
- **Email:** `owner@demo-shop.case-closed.test`
- **Password:** not written here. It is in a mode-600 file on the server and is handed to the organizers on request.
- **Prepared for the demo (do not use them for anything else):**

| Use | Reference | Transaction id | Amount | State now |
|---|---|---|---|---|
| Partial refund | demo-partial-refund | `eb2fd0ad-03b1-44a0-937b-f9fb790863a0` | 10.000 BD | captured, nothing refunded |
| Full refund | demo-full-refund | `31eaaf5a-0c3b-4267-b467-4ff179db7875` | 10.000 BD | captured, nothing refunded |
| Checkout | demo-checkout | link `plink_YBZmrrqbXxSjaQ3VhxmRcJ` | 4.750 BD | unpaid (active), expires 2 Nov 2026 |

## Steps

| # | Time | Do this | Expected result |
|---|---|---|---|
| 1 | 0:00 | Open **http://139.59.57.26/dashboard/login**. Paste the Merchant ID, type the email and password, click **Continue**. | A second form asks for the one-time code. On this demo server only, the code appears on the page under the form as **"Development code: 123456"** (no SMS or email sender exists; see SUBMISSION "Decisions and open risks"). |
| 2 | 0:10 | Type that code, click **Verify**. | The dashboard opens on **Transactions**; your email and role "owner" are in the header. |
| 3 | 0:15 | Open **http://139.59.57.26/dashboard/transactions/eb2fd0ad-03b1-44a0-937b-f9fb790863a0** (or click the row with reference **demo-partial-refund**). | Status **captured**, captured 10.000 BHD, refunded amount 0.000 BHD. A **Refund** button is shown. |
| 4 | 0:25 | Click **Refund**. Type **4.000** in **Amount (BD)**, reason "partial demo", click **Refund**, confirm the browser dialog. | The page reloads: status **partially_refunded**, refunded amount **4.000 BHD**; the form line shows "still refundable 6.000 BHD". |
| 5 | 0:40 | Open **http://139.59.57.26/dashboard/transactions/31eaaf5a-0c3b-4267-b467-4ff179db7875** (reference **demo-full-refund**). Click **Refund**, type **10.000**, click **Refund**, confirm. | Status **refunded**, refunded amount **10.000 BHD**; the Refund button disappears (nothing left to refund). |
| 6 | 0:55 | Open **http://139.59.57.26/dashboard/settlement**. | The settlement batch list loads. Today's payments join a batch when the nightly run closes the Bahrain business day; earlier batches show Gross, Fee, Refunds and Net, and Gross − Fee − Refunds + fee returned = Net. |
| 7 | 1:05 | Open **http://139.59.57.26/dashboard/reconciliation** (the page preselects the last 30 days up to tomorrow, Bahrain time). | The figures load, including the two refunds, with the green badge **"Reconciled — no gap"** (Gap 0.000 BHD). |
| 8 | 1:15 | Open **http://139.59.57.26/pay/plink_YBZmrrqbXxSjaQ3VhxmRcJ** in a new tab. | Checkout page: **Case Closed Demo Shop W.L.L.**, "Judges demo demo-checkout", **4.750 BHD**, a card form and a **Pay 4.750** button. |
| 9 | 1:20 | Card **4242 4242 4242 4242**, expiry **12 / 2030**, CVV **123**, click **Pay 4.750**. | "Payment successful", with the transaction id and the paid time. Opening the link again shows it as already paid. |

## What the rehearsal showed (9:20 PM, live server, second set)

- Login + OTP: the code was shown in the login answer, as on the page; verify 200.
- Partial refund 4.000 BD: 200 → `partially_refunded`, captured 10000, refunded 4000.
- Full refund 10.000 BD: 200 → `refunded`, captured 10000, refunded 10000.
- Settlement batches: 200. Reconciliation today: ledger 41681 fils, **gap 0**, explained; the page's default 30-day window (2026-09-30 to 2026-10-31): gap 0, explained.
- Checkout link: active, 4750 fils → paid by card → link "paid".
- Pages `/dashboard/login`, `/dashboard/transactions`, `/dashboard/settlement`, `/dashboard/reconciliation` and the demo checkout link answer 200. Headless Chrome rendered the checkout (shop name, 4.750 BHD, card form, "Pay 4.750") and the login form.
- The demo set stayed untouched: both transactions captured with nothing refunded, and the checkout link active.

## If the live site is down

Use the screenshots in **docs/ui/after/**: `dashboard-login.png`, `dashboard-transactions.png`, `refund-partial-transaction.png`, `refund-batch-list.png`, `refund-batch-detail.png`, `dashboard-settlement.png`, `dashboard-reconciliation.png`, `checkout-pay.png` and `checkout-pay-mobile.png`.
