# Frame local pre-order setup

The pre-order funnel is deliberately local-only and fail-closed while its legal
version is marked `draft`. Nothing in this setup enables public sales.

## Fast UI preview

```bash
npm run dev
```

Open `http://localhost:3000/preorder/review`. The default local preview completes with
a synthetic `FR-TEST-0001` order and does not call Stripe, Supabase, or Resend.

## Full Stripe test workflow

1. Apply `supabase/migrations/20260804000000_add_preorders.sql` to the existing
   Supabase project.
2. In Stripe test mode, create one active, one-time USD Price for $299.00.
3. Configure Stripe's test-mode public details and terms-of-service URL so
   Checkout can require terms acceptance.
4. Add these values to `.env.local`:

```dotenv
PREORDER_MODE=test
PREORDER_PREVIEW_MODE=false
PREORDER_PRICE_CENTS=29900
PREORDER_CURRENCY=usd
PREORDER_ALLOWED_COUNTRIES=US
PREORDER_ESTIMATED_DELIVERY=January 1, 2027
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PREORDER_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PREORDER_PRICE_ID=price_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_WEBHOOK_ENDPOINT_ID=we_...
RESEND_API_KEY=re_...
PREORDER_FROM_EMAIL=Frame Pre-orders <preorders@framewearable.com>
```

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
- the source terms version no longer begins with `draft`;
- `PREORDER_LEGAL_APPROVED_VERSION` exactly matches that source version; and
- a live Stripe secret and approved live Price are configured.

The draft pages, prices, countries, tax setting, shipping treatment, product
copy, cancellation process, and delivery wording must all be replaced or
approved before changing that lock.

The legacy `STRIPE_SECRET_KEY`, `STRIPE_PREORDER_PRICE_ID` and
`STRIPE_WEBHOOK_SECRET` values remain supported for local test workflows. Hosted
pre-orders should use the explicit `STRIPE_TEST_*` and `STRIPE_LIVE_*` values so
test-order refunds and delayed webhooks remain recoverable after live cutover.
