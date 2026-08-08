# Frame local pre-order setup

The pre-order funnel is deliberately local-only and fail-closed while its legal
version is marked `draft`. Nothing in this setup enables public sales.

The public homepage remains unchanged and contains no pre-order link. Remote
pre-order pages and APIs are rejected by the Worker before application routing.
Use `npm run preorder:test:visibility` to verify that boundary.

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
PREORDER_SHIPPING_RATE_CENTS=1900
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PREORDER_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PREORDER_PRICE_ID=price_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_WEBHOOK_ENDPOINT_ID=we_...
RESEND_API_KEY=re_...
PREORDER_FROM_EMAIL=Frame Pre-orders <preorders@framewearable.com>
PREORDER_ORDER_ACCESS_SECRET=<unique secret of at least 32 characters>
PREORDER_RATE_LIMIT_SECRET=<second unique secret of at least 32 characters>
PREORDER_MAINTENANCE_SECRET=<third unique secret of at least 32 characters>
```

The shipping value is a provisional flat $19 USD standard shipping and handling
charge for all 50 states and Washington, DC. US territories and international
destinations are excluded from the initial launch. Revalidate the rate against
the final boxed weight, dimensions, US fulfilment origin, fulfilment fees and
lithium-battery classification before public sales are opened.

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
- the incorporated seller details are complete;
- the source legal and Product Status versions no longer begin with `draft`;
- `PREORDER_LEGAL_APPROVED_VERSION` exactly matches that source version; and
- `PREORDER_PRODUCT_STATUS_APPROVED_VERSION` exactly matches the Product Status version;
- the one-year limited hardware warranty and the scheduled delivery-deadline processor are active; and
- a live Stripe secret and approved live Price are configured.

The draft pages, prices, countries, tax setting, shipping treatment, product
copy, cancellation process, and delivery wording must all be replaced or
approved before changing that lock.

The legacy `STRIPE_SECRET_KEY`, `STRIPE_PREORDER_PRICE_ID` and
`STRIPE_WEBHOOK_SECRET` values remain supported for local test workflows. Hosted
pre-orders should use the explicit `STRIPE_TEST_*` and `STRIPE_LIVE_*` values so
test-order refunds and delayed webhooks remain recoverable after live cutover.
