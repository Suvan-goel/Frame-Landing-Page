# Frame local pre-order setup

The pre-order funnel is deliberately local-only and fail-closed while its legal
version is marked `draft`. Nothing in this setup enables public sales.

The public homepage remains unchanged and contains no pre-order link. Remote
pre-order pages and APIs are rejected by the Worker before application routing.
Use `npm run preorder:test:visibility` to verify that boundary.

Run `npm run preorder:check:email` for a read-only transactional-email preflight.
It validates the exact Frame pre-order sender, support routing, inbound MX, root
SPF, Resend DKIM and return-path records, and the DMARC enforcement policy. It
does not send an email or change DNS or Resend. A restricted sending-only Resend
credential is preferred; the check does not require domain-administration access.
The signed `/api/resend/webhook` endpoint also records `sent`, `delivered`,
`delivery_delayed`, `failed`, `bounced`, `complained` and `suppressed` outcomes
for each new pre-order email. Apply
`20260810120000_track_preorder_email_delivery_outcomes.sql` before deploying the
matching application source. Existing historical sends remain labelled as
legacy; new tracked sends must reach a delivered outcome within ten minutes.

Run `npm run preorder:check:payments:test` to reconcile every paid Stripe test
pre-order against its stored checkout intent, order and payment record. The live
equivalent is `npm run preorder:check:payments`. Both commands are read-only:
they compare identifiers, customer references, subtotal, shipping, tax, total,
currency, captured amount, refunds and disputes, and detect paid Stripe sessions
that never became orders. They never create or refund a payment or update a row.

Run `npm run preorder:check:operations:test` for the sandbox operations-health
gate. The live equivalent is `npm run preorder:check:operations`. It reports
whether sales are safe to accept by checking failed or five-minute-stalled
Stripe webhooks, failed, delayed, bounced, complained, suppressed or
ten-minute-unconfirmed email delivery, missing order
confirmations, unresolved cancellations/refunds/disputes/address changes,
overdue delivery-consent actions, fulfilment state, and exact paid/reserved unit
totals against both released and lifetime inventory ceilings. It is read-only:
it does not retry work, send email, refund an order, pause sales, or change data.

## Fast UI preview

```bash
npm run dev
```

Open `http://localhost:3000/preorder/review`. The default local preview completes with
a synthetic `FR-TEST-0001` order and does not call Stripe, Supabase, or Resend.

## Full Stripe test workflow

1. Apply all pending files in `supabase/migrations` to the existing Supabase
   project. The inventory-ceiling migration fixes the lifetime ceiling at
   1,000 units and keeps live released capacity at zero until an owner raises it.
2. In Stripe test mode, create one active, one-time USD Price for $299.00 with
   tax behaviour set to exclusive.
3. Configure Stripe's test-mode public details and terms-of-service URL so
   Checkout can require terms acceptance.
4. Add these values to `.env.local`:

```dotenv
PREORDER_MODE=test
PREORDER_PREVIEW_MODE=false
PREORDER_PRICE_CENTS=29900
PREORDER_CURRENCY=usd
PREORDER_ALLOWED_COUNTRIES=US
PREORDER_ESTIMATED_SHIPPING=Q1 2027
PREORDER_SHIPPING_RATE_CENTS=0
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PREORDER_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PREORDER_PRICE_ID=price_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_WEBHOOK_ENDPOINT_ID=we_...
RESEND_API_KEY=re_...
MAILING_POSTAL_ADDRESS=<authorised public customer correspondence address>
PREORDER_FROM_EMAIL=Frame Pre-orders <preorders@framewearable.com>
PREORDER_ORDER_ACCESS_SECRET=<unique secret of at least 32 characters>
PREORDER_RATE_LIMIT_SECRET=<second unique secret of at least 32 characters>
PREORDER_MAINTENANCE_SECRET=<third unique secret of at least 32 characters>
```

As of August 10, 2026, the public domain publishes Microsoft inbound MX,
one bounded root SPF policy, Resend DKIM, Resend return-path SPF and feedback
MX, and a DMARC `p=quarantine` policy. Keep those records in place. Public DNS
cannot prove that the individual support mailbox is actively monitored, so a
controlled reply test remains a separate final rehearsal after explicit approval.

The shipping value is zero because standard shipping is free for all 50 states
and Washington, DC. US territories and international destinations are excluded
from the initial launch. Validate the internal shipping budget against the final
boxed weight, dimensions, US fulfilment origin, fulfilment fees and lithium-battery
classification before public sales are opened.

The live environment begins with a cumulative release allocation of 100 units
inside the fixed 1,000-unit lifetime inventory ceiling. Applying the release
migration keeps the live sales status paused; it does not make the allocation
available for purchase.

5. Forward Stripe test events to the local webhook:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

6. Complete `/preorder/review` with a Stripe test card. Successful orders appear
   at `/admin/preorders` after signing in with an email in
   `WAITLIST_ADMIN_EMAILS`.

If Resend is not configured, the paid order still succeeds. The failed
confirmation delivery is recorded for retry and appears in the owner view.

Verified Stripe events are durably claimed before the webhook returns success.
Production Workers finish the order, refund or dispute work in the background;
failed or five-minute-stalled events remain visible and retryable in the owner
view. The webhook route intentionally stays available even when new pre-order
sales are paused.

## Launch lock

Public requests remain blocked unless all of the following are true:

- `PREORDER_MODE=live`;
- the incorporated seller details, registered office, and separately authorised public correspondence address are complete;
- the source legal and Product Status versions no longer begin with `draft`;
- `PREORDER_LEGAL_APPROVED_VERSION` exactly matches that source version; and
- `PREORDER_PRODUCT_STATUS_APPROVED_VERSION` exactly matches the Product Status version;
- `PREORDER_PUBLIC_LAUNCH_ENABLED=true` and `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID` identifies the fully refunded private live-verification order;
- the one-year limited hardware warranty and the scheduled delivery-deadline processor are active; and
- a live Stripe secret and approved live Price are configured; and
- the live Stripe Account passes the read-only activation, card capability, payout, KYC, legal identity, business/support profile, statement descriptor, agreement acceptance, and branding checks.
- every paid live Stripe pre-order passes `npm run preorder:check:payments`, with no orphaned sessions, amount mismatches, stale refund state, or unrecorded dispute.
- `npm run preorder:check:operations` reports `SAFE TO ACCEPT ORDERS`, with no failed or stalled operational work and exact inventory totals.

The draft pages, prices, countries, tax setting, shipping treatment, product
copy, cancellation process, and delivery wording must all be replaced or
approved before changing that lock.

The legacy `STRIPE_SECRET_KEY`, `STRIPE_PREORDER_PRICE_ID` and
`STRIPE_WEBHOOK_SECRET` values remain supported for local test workflows. Hosted
pre-orders should use the explicit `STRIPE_TEST_*` and `STRIPE_LIVE_*` values so
test-order refunds and delayed webhooks remain recoverable after live cutover.
