# UI before and after

Screenshots for CASE-FILE Item 05 (UI and UX, 10 points): checkout, the merchant
dashboard and the admin console.

- `before/` = the screens as inherited (commit a12d4c7).
- `after/`  = the screens now (same file names, same pages, same data).

## How they were made (30 Oct 2026, 3:15-3:35 PM)

1. One fresh database, migrated by today's migrations and filled by `npm run seed`;
   one active payment link (12.750 BD, "Invoice #1042") for the checkout pictures;
   the reporting worker ran once so the overview has data.
2. Today's API served both sets. The inherited API cannot build a full schema
   (E01: migrations stop at 0054), so it could not be run as-is.
3. `before/`: the original apps/web and apps/admin from a git worktree at a12d4c7.
   The original web app called `http://localhost:3000` directly and could not reach
   the API in development (E61). To show its screens with data, it was served with a
   proxy config kept outside the repo; no original source file was changed.
4. `after/`: today's apps/web and apps/admin (Vite dev servers).
5. A puppeteer-core script drove the installed Chrome: 1280x860 for every page,
   390x844 (phone) for checkout. Login went through the real login and OTP routes
   (dev OTP shown, local only).

## Second set: the UX pass (30 Oct 2026, before at 10:36 PM, after at 11:05 PM)

The whole set was re-taken for the UX pass, with more screens (checkout states,
link creation, refund, not-found pages, admin merchant detail). Same method as above,
one script for both sets (kept outside the repo: scratchpad/shot/ux-shots.mjs):

1. The local database used for the first set, migrated to today's migrations (0085-0088).
2. Today's API (restarted on the code-freeze commit) served both sets.
3. `before/`: the original apps/web and apps/admin at a12d4c7 (proxy config outside
   the repo, as above). `after/`: today's apps/web and apps/admin.
4. The script logs in through the forms, creates its own payment links through the
   public API (one paid, one left to expire after 70 s), pays one with a declining
   card and then an approving test card, refunds 5.000 BHD, and saves each screen.
   Desktop 1280x860; phone 390x844 for the checkout states and one dashboard list.
5. Only screens with a before file were copied into `after/` (28 pairs). The refund form does not exist in the inherited code; its picture is `after/refund-partial-transaction.png` from the first set.

## What changed in the UI

| Screen | Before | After | Where |
|---|---|---|---|
| Checkout | Expiry/CVV row wider than the form; tiny month box; on a phone the CVV box runs off the screen | Three equal columns that fit the form on desktop and phone | apps/web/src/pages/checkout/CheckoutPage.css |
| Dashboard and admin tables | Digits of different widths; BHD amounts do not line up | Tabular numbers: every digit the same width | apps/web/src/dashboard.css, apps/admin/src/admin.css |
| Checkout (behaviour, earlier fixes) | Expired link still payable (FP-187); refund drawer missing | Server-side expiry (E03); refund drawer (F01f) | see docs/LOG.md |
| Admin settlement | No warning when MDR recalculation must skip a batch | Red notice listing skipped batch dates (E120) | apps/admin/src/pages/settlement/SettlementPage.tsx |

Not changed (recorded): money columns are still left-aligned. Right-aligning them
needs a class on 29 cells in 10 files, so it waits for Zainab's OK.
