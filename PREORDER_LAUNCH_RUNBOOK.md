# Frame pre-order launch runbook

This runbook keeps the public checkout closed until every commercial, operational and legal dependency is ready. The database `live` allocation must remain `paused` until the final cutover step.

## 1. Current local state

- Stripe test mode is connected at $299 USD for one device.
- Orders are limited to United States shipping.
- The recorded estimated delivery date is January 1, 2027.
- Customer confirmation, management, address, delivery, cancellation, shipping and refund emails are connected.
- Test and live commerce records are separated.
- Live allocation is paused.

Run the local preflight at any time:

```bash
npm run preorder:check
```

Run the sandbox concurrency and recovery checks before each hosted rehearsal and final cutover:

```bash
npm run preorder:test:reliability
```

This command requires Stripe test mode and a paused live allocation. It temporarily exercises the test allocation, duplicate checkout requests, unit-limit contention, rate limiting and webhook recovery. It restores the test allocation and deletes its uniquely named synthetic records even if a check fails.

## 2. Private staging rehearsal

Private staging must use Stripe test mode and must not contain a legal approval value.

Required hosted staging values:

```text
PREORDER_MODE=test
PREORDER_LEGAL_APPROVED_VERSION=
PREORDER_STAGING_ACCESS_SECRET=<unique secret of at least 32 characters>
STRIPE_SECRET_KEY=<test key>
STRIPE_PREORDER_PRICE_ID=<test $299 price>
STRIPE_WEBHOOK_SECRET=<staging endpoint signing secret>
```

It also needs the existing Supabase, Resend, sender, operations-email and dedicated order/rate-limit secret values. Keep `PREORDER_ORDER_ACCESS_SECRET` stable between staging deployments or previously emailed management links will stop working.

Before staging:

```bash
npm run preorder:check:staging
```

After a private staging URL exists, create a 30-minute invitation link:

```bash
npm run preorder:staging-link -- https://staging.example.com
```

The invitation grants a signed, secure, 12-hour browser session. Rotating `PREORDER_STAGING_ACCESS_SECRET` revokes outstanding access.

## 3. Legal and regulatory hold

Do not complete this section until the lawyer and medical-device regulatory review are finished.

- Replace every draft policy and bracketed placeholder with approved wording.
- Assign a new non-draft `PREORDER_TERMS_VERSION` and matching product-status version in the application.
- Set `PREORDER_LEGAL_APPROVED_VERSION` to exactly the approved terms version.
- Re-run the full test suite after the version and copy change.

The application rejects live checkout while the active version begins with `draft` or does not exactly match the configured approval value.

## 4. Live payment and hosted configuration

Create a separate Stripe live Product and one-time $299 USD Price. Never reuse test IDs in live configuration.

The live objects were created on August 6, 2026:

```text
Stripe live Product: prod_V1TpdgeLFHGdXr
Stripe live Price: price_1U1Qrd2WBYpT3ouEs8Hbk5lk
```

The Price is the Product's default price. Both are active in Stripe live mode and carry `frame_preorder`, live-environment and paused-launch metadata. Local development must continue using the separate test Price.

Required live values:

```text
PREORDER_MODE=live
PREORDER_LEGAL_APPROVED_VERSION=<exact approved non-draft version>
STRIPE_SECRET_KEY=<live key>
STRIPE_PREORDER_PRICE_ID=<live $299 price>
STRIPE_WEBHOOK_SECRET=<live endpoint signing secret>
PREORDER_PRICE_CENTS=29900
PREORDER_CURRENCY=usd
PREORDER_ALLOWED_COUNTRIES=US
PREORDER_ESTIMATED_DELIVERY=January 1, 2027
```

Copy the Supabase, Resend, sender, operations-email, order-link and rate-limit values into the hosted environment. Use different values for `PREORDER_ORDER_ACCESS_SECRET` and `PREORDER_RATE_LIMIT_SECRET`. Do not expose any secret in source control.

The live Stripe webhook endpoint is:

```text
https://framewearable.com/api/stripe/webhook
```

Subscribe it to the checkout, refund and dispute events already handled by the application.

## 5. Final cutover

1. Confirm the Supabase `live` allocation is still `paused`.
2. Run `npm run preorder:check:launch` against the exact values intended for production.
3. Complete one live-mode smoke purchase only if approved by the payment and legal launch plan, then refund it and verify the order, webhook and email records.
4. Review capacity and set the live unit limit.
5. Open the `live` allocation from the authenticated owner view.
6. Confirm the public homepage button reaches review and Stripe live Checkout.

Opening the live allocation is intentionally the last step. The owner API will refuse it if any launch safeguard fails.

## 6. Emergency pause

If checkout, email, webhook, fulfilment or policy behaviour is uncertain:

1. Set the `live` allocation to `paused` in the owner view.
2. Confirm new checkout reservations are rejected.
3. Preserve Stripe, Supabase, email and webhook records for diagnosis.
4. Reopen only after `npm run preorder:check:launch` passes again.

Pausing allocation does not remove existing orders or customer-management links.
