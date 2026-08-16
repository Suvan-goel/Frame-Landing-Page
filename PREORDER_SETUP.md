# Frame reservation setup

The reservation candidate remains fail-closed until its legal approval,
dedicated Stripe Price, private live-smoke order and inventory safeguards all
pass. Nothing in this setup alone enables public reservation sales.

Until the reservation cutover, the public site continues to serve the legacy
full-payment release. During the controlled cutover, remote reservation pages
and APIs are rejected by the Worker before application routing. Use
`npm run preorder:test:visibility` to verify that boundary.

Run `npm run preorder:check:email` for a read-only transactional-email preflight.
It validates the exact Frame pre-order sender, support routing, inbound MX, root
SPF, Resend DKIM and return-path records, and the DMARC enforcement policy. It
does not send an email or change DNS or Resend. A restricted sending-only Resend
credential is preferred; the check does not require domain-administration access.
The signed `/api/resend/webhook` endpoint also records `sent`, `delivered`,
`delivery_delayed`, `failed`, `bounced`, `complained` and `suppressed` outcomes
for each new reservation email. Apply
all migrations through `20260814010000_add_reservation_funnel_analytics.sql` before
deploying the matching application source. Existing historical sends remain
labelled as legacy; new tracked sends must reach a delivered outcome within ten
minutes. The numbering migration ensures the first generated customer order
number is at least 10 without reusing any number already issued.

The reservation funnel writes a separate first-party analytics record for each
whitelisted milestone. Event payloads accept acquisition labels, placements,
objection categories, willingness bands and evidence categories only. They
reject email addresses, health answers and free text. Browser event IDs and a
tab-scoped session ID make retries idempotent without weakening the optional
Meta tracking-consent boundary.

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
2. In Stripe test mode, create one active, one-time USD Price for $99.00 with
   tax behaviour set to exclusive. Its Product must use the exact reviewed
   reservation name, description, image, and tax code enforced by checkout.
3. Configure Stripe's test-mode public details and terms-of-service URL so
   Checkout can require terms acceptance.
4. Add these values to `.env.local`:

```dotenv
PREORDER_MODE=test
PREORDER_PREVIEW_MODE=false
FRAME_RESERVATION_PRICE_CENTS=9900
PREORDER_CURRENCY=usd
PREORDER_ALLOWED_COUNTRIES=US
PREORDER_ESTIMATED_SHIPPING=Q1 2027
PREORDER_SHIPPING_RATE_CENTS=0
STRIPE_SECRET_KEY=sk_test_...
STRIPE_RESERVATION_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_RESERVATION_PRICE_ID=price_...
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
from the initial launch. The founder-approved provisional fulfilment allowance
is $40 per order: $30 for outbound fulfilment plus a $10 pooled allowance for
delivery, return and warranty exceptions. Validate that allowance against the
final boxed weight, dimensions, US fulfilment origin, fulfilment fees and
lithium-battery assumptions before inventory is committed or fulfilment begins,
using the revalidation triggers in `docs/preorder-pre-incorporation-pack.md`.
The founder-approved provisional product configuration is one rechargeable
lithium-ion or lithium-polymer battery, installed in each wearable and expected
to be below 20 Wh. Before the production battery is approved or the first unit
is offered for transport, complete the data-sheet, exact Wh, UN 38.3, packing,
marking, carrier-acceptance and returns-procedure evidence listed in the same
pack. The assumption is not itself a completed transport classification.

The live environment begins with a cumulative release allocation of 100 units
inside the fixed 1,000-unit lifetime inventory ceiling. Applying the release
migration keeps the live sales status paused; it does not make the allocation
available for purchase.

5. Forward Stripe test events to the local webhook:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

6. Complete `/preorder/review` with a Stripe test card. Checkout charges $99
   only. Successful reservations appear
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
- the live Stripe Account passes the read-only activation, card capability, KYC, legal identity, business/support profile, statement descriptor, agreement acceptance, and branding checks. Payouts and an automatic schedule are also required unless `PREORDER_ALLOW_BANK_PENDING_LAUNCH=true` explicitly permits the missing or verifying external payout account; that exception never waives live charges or a non-bank verification requirement.
- every paid live Stripe pre-order passes `npm run preorder:check:payments`, with no orphaned sessions, amount mismatches, stale refund state, or unrecorded dispute.
- `npm run preorder:check:operations` reports `SAFE TO ACCEPT ORDERS`, with no failed or stalled operational work and exact inventory totals.

The draft pages, prices, countries, tax setting, shipping treatment, product
copy, cancellation process, and delivery wording must all be replaced or
approved before changing that lock.

The legacy `STRIPE_PREORDER_PRICE_ID`, `STRIPE_TEST_PREORDER_PRICE_ID`, and
`STRIPE_LIVE_PREORDER_PRICE_ID` values identify the former $299 product only.
Retain them where historical, already-created Checkout Sessions still need to be
verified, but new checkout always uses the dedicated `*_RESERVATION_PRICE_ID`.
Hosted environments should keep explicit test and live credentials so refunds
and delayed webhooks remain recoverable after live cutover.
