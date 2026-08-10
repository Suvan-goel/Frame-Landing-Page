# Frame pre-order launch runbook

This is the canonical launch runbook. The supporting evidence and handoff template
is [`docs/preorder-pre-incorporation-pack.md`](docs/preorder-pre-incorporation-pack.md).
Do not duplicate launch instructions elsewhere.

This runbook keeps the public checkout closed until every commercial,
operational and legal dependency is ready. The database `live` allocation must
remain `paused` until the final cutover step.

## 0. Current public launch hold

Pre-order source may be deployed while the launch locks below remain intact.
The public homepage must remain waitlist-only, and remote pre-order pages,
checkout APIs and public status routes must return `404`. Owner routes must
remain authenticated and launch-gated. Local loopback requests remain available
for development and Stripe test-mode checks.

Keep every safeguard in place:

- `PREORDER_MODE` stays `test` or `off` until private live verification;
- `PREORDER_LEGAL_APPROVED_VERSION` stays empty;
- `PREORDER_PRODUCT_STATUS_APPROVED_VERSION` stays empty;
- `PREORDER_TAX_REVIEW_APPROVED_VERSION` stays empty;
- both source legal versions continue to begin with `draft`;
- `PREORDER_PUBLIC_LAUNCH_ENABLED` stays `false` and
  `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID` stays empty; and
- the Supabase `live` allocation stays `paused`.

Run `npm run preorder:test:visibility` after any routing, homepage, Worker or
environment change. It verifies that the public homepage has no pre-order link
and every remote pre-order surface remains unavailable.

## 1. Current local state

- Stripe test mode is connected at $299 USD for one device.
- Orders are limited to all 50 United States and Washington, DC; US territories and international destinations are excluded.
- The recorded estimated shipping window is Q1 2027.
- The offer is $299 USD plus applicable sales tax, with free standard US shipping.
- Customer confirmation, management, address, delivery, cancellation, shipping and refund emails are connected.
- Test and live commerce records are separated.
- The lifetime inventory ceiling is 1,000 units, with an approved initial cumulative release allocation of 100 units.
- Live allocation is paused.

Run the local preflight at any time:

```bash
npm run preorder:check
```

Run the email-only preflight without sending a message or touching provider
settings:

```bash
npm run preorder:check:email
```

It must confirm the exact pre-order sender and support routing plus inbound MX,
one bounded root SPF policy, Resend DKIM and return-path SPF/MX, and an enforced
DMARC quarantine or reject policy. Keep the Resend API key restricted to sending;
domain-administration permission is not required by this check.

The same signature-verified Resend endpoint must remain subscribed to
`email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`,
`email.bounced`, `email.complained` and `email.suppressed`. After the provider
outcome migration is applied, every new pre-order email is linked by Resend
message ID and updated in timestamp order; duplicate `svix-id` deliveries are
ignored and an out-of-order success cannot erase a newer terminal failure.

Run the sandbox payment comparison after any checkout, refund or webhook change:

```bash
npm run preorder:check:payments:test
```

The live form is `npm run preorder:check:payments`. It reads all Frame pre-order
Checkout Sessions created from August 1, 2026 onward and compares every paid
session with Supabase checkout-intent, order and payment records plus Stripe's
PaymentIntent, latest Charge, Refunds and Disputes. It reports safe order/session
references but no customer details, and cannot move money or update either system.
The restricted Stripe key therefore needs read access to Checkout Sessions,
PaymentIntents, Charges, Refunds and Disputes in addition to its existing runtime
permissions.

Run the sandbox operations gate after any webhook, email, cancellation, refund,
delivery-deadline, fulfilment or inventory change:

```bash
npm run preorder:check:operations:test
```

The live form is `npm run preorder:check:operations`. It returns either
`SAFE TO ACCEPT ORDERS` or `PAUSE SALES` after reading the selected environment's
webhook recovery records, latest email streams, order workflows, delivery
deadlines, order items, checkout reservations and sales-control snapshot. It
does not retry, send, refund, pause or update anything. Reserved example-domain
recipients are ignored only in the sandbox. Live delayed, failed, bounced,
complained, suppressed, and ten-minute-unconfirmed sends always block.

Run the sandbox concurrency and recovery checks before each hosted rehearsal and final cutover:

```bash
npm run preorder:test:reliability
```

This command requires Stripe test mode and a paused live allocation. It temporarily exercises the test allocation, duplicate checkout requests, unit-limit contention, rate limiting and webhook recovery. It restores the test allocation and deletes its uniquely named synthetic records even if a check fails.

## 2. Private staging rehearsal

This is an optional later phase and is not part of the current local-only hold.
Do not create or distribute a staging invitation until a private rehearsal is
explicitly approved.

Private staging must use Stripe test mode and must not contain a legal approval value.

Required hosted staging values:

```text
PREORDER_MODE=test
PREORDER_LEGAL_APPROVED_VERSION=
PREORDER_PRODUCT_STATUS_APPROVED_VERSION=
PREORDER_STAGING_ACCESS_SECRET=<unique secret of at least 32 characters>
PREORDER_MAINTENANCE_SECRET=<third unique secret of at least 32 characters>
STRIPE_SECRET_KEY=<test key>
STRIPE_PREORDER_PRICE_ID=<test $299 price>
STRIPE_WEBHOOK_SECRET=<staging endpoint signing secret>
STRIPE_TEST_SECRET_KEY=<test key>
STRIPE_TEST_PREORDER_PRICE_ID=<test $299 price>
STRIPE_TEST_WEBHOOK_SECRET=<staging endpoint signing secret>
STRIPE_TEST_WEBHOOK_ENDPOINT_ID=<test endpoint ID>
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

## 3. Company, legal, tax and fulfilment hold

The founder confirmed on August 10, 2026 that the regulatory review is complete
and requires no site-copy changes. Retain the underlying review record outside
the repository and reassess it before any material claim, intended-use, output,
alert or product-design change.

Do not release the legal or tax approval locks until the remaining reviews and
company-identity work are finished.

- Insert the incorporated seller identity, the document-matched registered office, and the separately authorised customer correspondence address. Set `correspondenceAddressAuthorized` only after mail-provider approval, configure `MAILING_POSTAL_ADDRESS`, and replace every remaining draft marker or placeholder with approved wording.
- Review the one-year limited hardware warranty, shipping-delay consent matrix, material-change consent flow, and automatic deadline refund operation with US counsel.
- Validate that the internal shipping budget can absorb the final packaged dimensions and weight, US fulfilment origin and fees, and lithium-battery classification; confirm Stripe Tax registrations with the relevant advisers.
- Assign an explicit Stripe product tax code approved for Frame's final product classification.
- Assign a new non-draft `PREORDER_TERMS_VERSION` and matching product-status version in the application.
- Set `PREORDER_LEGAL_APPROVED_VERSION` to exactly the approved terms version.
- Set `PREORDER_PRODUCT_STATUS_APPROVED_VERSION` to exactly the approved Product Status Disclosure version.
- Re-run the full test suite after the version and copy change.

The application rejects live checkout while the active version begins with `draft` or does not exactly match the configured approval value.

## 4. Live payment and hosted configuration

Create a separate Stripe live Product and one-time $299 USD Price. Never reuse test IDs in live configuration.

Before private live verification, the live Stripe Account must show the Stripe Services Agreement accepted and live charges and card payments active. By default, it must also show every onboarding detail submitted, payouts enabled with an automatic schedule, and no current, past-due, failed, or pending-verification requirements. If the company payout account alone is still missing or being verified, `PREORDER_ALLOW_BANK_PENDING_LAUNCH=true` may temporarily waive only the external-account, payout-enabled and automatic-schedule checks. Live charges must remain active and every non-bank verification requirement must still be clear; customer proceeds remain in Stripe until the payout account is connected. Its US company name must match `lib/company.ts`; configure the Frame public website, monitored support email and `/contact` URL, merchant category, product description, a 5–22 character statement descriptor containing `FRAME`, and an icon or logo plus primary brand colour. The pre-order Checkout session supplies its own Frame presentation and links the Pre-order Terms, Cancellation and Refund Policy, and Privacy Notice on Stripe's hosted page.

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
PREORDER_PRODUCT_STATUS_APPROVED_VERSION=<exact approved non-draft version>
PREORDER_TAX_REVIEW_APPROVED_VERSION=<exact approved tax-policy version>
PREORDER_PREVIEW_MODE=false
PREORDER_LIVE_SMOKE_ACCESS_SECRET=<fourth unique secret of at least 32 characters>
PREORDER_PUBLIC_LAUNCH_ENABLED=false
PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID=
PREORDER_ALLOW_BANK_PENDING_LAUNCH=false
PREORDER_FROM_EMAIL=Frame Pre-orders <preorders@framewearable.com>
PREORDER_OPERATIONS_EMAIL=support@framewearable.com
PREORDER_ORDER_ACCESS_SECRET=<stable dedicated secret of at least 32 characters>
PREORDER_RATE_LIMIT_SECRET=<different dedicated secret of at least 32 characters>
PREORDER_STAGING_ACCESS_SECRET=<different staging secret of at least 32 characters>
STRIPE_SECRET_KEY=<live key>
STRIPE_PREORDER_PRICE_ID=<live $299 price>
STRIPE_WEBHOOK_SECRET=<live endpoint signing secret>
STRIPE_LIVE_SECRET_KEY=<restricted live key>
STRIPE_LIVE_PREORDER_PRICE_ID=<live $299 price>
STRIPE_LIVE_WEBHOOK_SECRET=<live endpoint signing secret>
STRIPE_LIVE_WEBHOOK_ENDPOINT_ID=<live endpoint ID>
PREORDER_PRICE_CENTS=29900
PREORDER_CURRENCY=usd
PREORDER_ALLOWED_COUNTRIES=US
PREORDER_ESTIMATED_SHIPPING=Q1 2027
PREORDER_SHIPPING_RATE_CENTS=0
PREORDER_MAINTENANCE_SECRET=<third unique secret of at least 32 characters>
MAILING_POSTAL_ADDRESS=<authorised public correspondence address>
RESEND_API_KEY=<restricted sending key>
SUPABASE_URL=<production project URL>
SUPABASE_SECRET_KEY=<production server secret>
```

Copy the Supabase, Resend, sender, operations-email, order-link and rate-limit values into the hosted environment. Use different values for `PREORDER_ORDER_ACCESS_SECRET` and `PREORDER_RATE_LIMIT_SECRET`. Do not expose any secret in source control.

Keep the 15-minute scheduled deadline processor enabled. It converts unanswered long, unknown, repeated-delay, and material-change notices into cancellations and full refunds. The maintenance, order-link, rate-limit, staging, and live-verification secrets must all be different.

Keep the explicit `STRIPE_TEST_*` values in the hosted environment after
cutover. The application selects Stripe credentials from each order or event's
recorded environment, allowing test-order refunds and delayed signed test
webhooks to be handled without ever using the live key. Both standard `sk_*`
and restricted `rk_*` Stripe keys are accepted when they match the selected
environment. A restricted live key must retain read access to the Account object
in addition to the existing checkout, refund, tax, price/product, and webhook
permissions. The readiness commands use that access only to inspect activation,
verification, payout, profile, descriptor, agreement, and branding state.

The live Stripe webhook endpoint is:

```text
https://framewearable.com/api/stripe/webhook
```

Subscribe both the test and live endpoints to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `refund.created`
- `refund.updated`
- `charge.refunded`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.closed`

The signed webhook route remains available when new sales are paused. Each
verified event is claimed in Supabase before Stripe is acknowledged, then
processed in the Worker background. Failed work and processing that has stalled
for five minutes appears in the owner recovery panel and can be safely retried.

## 5. Final cutover

Before each Sites publish, commit the exact validated source on `main`, push
`main`, and run `npm run release:check`. Package and publish only that exact
commit.

1. Configure live mode with `PREORDER_PUBLIC_LAUNCH_ENABLED=false`, an empty `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID`, and a unique `PREORDER_LIVE_SMOKE_ACCESS_SECRET`. Public pre-order routes remain hidden.
2. Keep the Supabase `live` allocation `paused` and set its released-unit ceiling to exactly `1`.
3. Run `npm run preorder:check:email`, `npm run preorder:check:payments`, `npm run preorder:check:operations`, then `npm run preorder:check:live-smoke`; do not continue unless all report zero failures, including every email identity/authentication check, live payment/order comparison, operations-health and inventory check, and live Stripe Account activation, verification, identity, customer-support, descriptor, agreement, and branding check. If `PREORDER_ALLOW_BANK_PENDING_LAUNCH=true`, the only permitted warning is that the payout account and automatic schedule remain pending.
4. Deploy the approved live configuration while the public-launch lock and paused allocation remain in place.
5. Create the 15-minute invitation with `npm run preorder:live-smoke-link`. Do not share it; it opens the real card-payment path for two hours in that browser.
6. From the authenticated owner view, open the one-unit live allocation. The control rejects any larger non-public live opening.
7. Use the invitation to complete one real-card order. Immediately pause the live allocation after Stripe accepts the payment.
8. Verify the charged subtotal, shipping and tax, signed webhook, live order record, delivered confirmation outcome, management link and operational alert. Then issue a full refund and wait until the order shows `refunded` with the full amount reconciled.
9. Copy that live pre-order UUID into `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID`, restore the paused released-unit ceiling to `100`, and set `PREORDER_PUBLIC_LAUNCH_ENABLED=true` in the coordinated public-cutover configuration.
10. Run `npm run preorder:check:payments`, `npm run preorder:check:operations`, then `npm run preorder:check:launch`. They verify that the private live order reconciles exactly with Stripe, came from the private path, completed through the webhook, recorded a delivered confirmation outcome, was fully refunded, and left no failed or stalled operational work.
11. Publish the public-cutover configuration and open the 100-unit live allocation from the authenticated owner view.
12. Confirm the public homepage button reaches review and Stripe live Checkout, then monitor the first public order before allowing more traffic.

If launch used the bank-pending exception, connect the approved company payout account as soon as it is available, configure automatic payouts, set `PREORDER_ALLOW_BANK_PENDING_LAUNCH=false`, and rerun `npm run preorder:check:launch`. Do not leave the exception enabled after Stripe reports payouts as available.

Opening the live allocation is intentionally the last step. The owner API will refuse it if any launch safeguard fails.

## 6. Emergency pause

If checkout, email, webhook, fulfilment or policy behaviour is uncertain:

1. Set the `live` allocation to `paused` in the owner view.
2. Confirm new checkout reservations are rejected.
3. Preserve Stripe, Supabase, email and webhook records for diagnosis.
4. Reopen only after `npm run preorder:check:operations` reports `SAFE TO ACCEPT ORDERS` and `npm run preorder:check:launch` passes again.

Pausing allocation does not remove existing orders or customer-management links.
It also does not block signed Stripe events or fulfilment for a customer who had
already completed payment.
