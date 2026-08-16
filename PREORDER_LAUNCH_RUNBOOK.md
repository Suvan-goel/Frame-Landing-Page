# Frame reservation launch runbook

This is the canonical launch runbook. The supporting evidence and handoff template
is [`docs/preorder-pre-incorporation-pack.md`](docs/preorder-pre-incorporation-pack.md).
Do not duplicate launch instructions elsewhere.

This runbook governs the pending transition from the legacy $299 full-payment
pre-order to the $99 refundable reservation. The August 12 full-payment launch
does not qualify as reservation verification. Follow the controlled cutover in
section 5 before exposing any reservation checkout publicly.

## 0. Reservation cutover state

The public site remains on the legacy full-payment release until the reservation
candidate, live Stripe catalog, hosted configuration and private live smoke have
all passed. Before deploying the reservation candidate, disable public checkout,
pause the live allocation and reduce its released-unit ceiling to one.

After the reservation cutover, keep these production invariants aligned:

- `PREORDER_MODE=live`;
- `PREORDER_LEGAL_APPROVED_VERSION=2026-08-16-v3`;
- `PREORDER_PRODUCT_STATUS_APPROVED_VERSION=2026-08-16-v2`;
- `PREORDER_TAX_REVIEW_APPROVED_VERSION=uk-remote-seller-2026-08-09-v1`;
- `PREORDER_PUBLIC_LAUNCH_ENABLED=true`;
- `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID` contains the verified, fully refunded
  private live-smoke order UUID;
- `PREORDER_PREVIEW_MODE=false` and
  `PREORDER_ALLOW_BANK_PENDING_LAUNCH=false`; and
- the Supabase `live` allocation remains open with a released-unit ceiling of
  `100`, unless an emergency pause is required.

Run `npm run preorder:test:visibility` after any routing, homepage, Worker or
environment change. It verifies the source-level visibility gates that prevent
public pre-order surfaces from being exposed without all required live launch
safeguards.

## 1. Current verified state

- Stripe test mode uses a dedicated one-time $99 USD reservation Price. The
  separate live reservation Product and Price must be created and verified
  before the reservation cutover; legacy $299 objects remain only for historic
  payment reconciliation.
- Orders are limited to all 50 United States and Washington, DC; US territories and international destinations are excluded.
- The recorded estimated shipping window is Q1 2027.
- The reservation offer is $99 USD plus applicable sales tax today, fully
  refundable, locking a $299 total price with $200 due before shipping and free
  standard US shipping. There is no subscription or automatic later charge.
- Customer confirmation, management, address, delivery, cancellation, shipping and refund emails are connected.
- Test and live commerce records are separated.
- The lifetime inventory ceiling is 1,000 units, with an approved initial cumulative release allocation of 100 units.
- The legacy live allocation may remain open only while the legacy public build
  is serving. It must be paused before the reservation candidate is deployed.

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

This remains available for future private rehearsals. Do not create or
distribute a staging invitation unless a new rehearsal is explicitly approved.

Private staging must use Stripe test mode and must not contain a legal approval value.

Required hosted staging values:

```text
PREORDER_MODE=test
PREORDER_LEGAL_APPROVED_VERSION=
PREORDER_PRODUCT_STATUS_APPROVED_VERSION=
PREORDER_STAGING_ACCESS_SECRET=<unique secret of at least 32 characters>
PREORDER_MAINTENANCE_SECRET=<third unique secret of at least 32 characters>
STRIPE_SECRET_KEY=<test key>
STRIPE_RESERVATION_PRICE_ID=<test $99 reservation price>
STRIPE_WEBHOOK_SECRET=<staging endpoint signing secret>
STRIPE_TEST_SECRET_KEY=<test key>
STRIPE_TEST_RESERVATION_PRICE_ID=<test $99 reservation price>
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

## 3. Company, legal, tax and fulfilment controls

The founder confirmed on August 10, 2026 that the regulatory review is complete
and requires no site-copy changes. Retain the underlying review record outside
the repository and reassess it before any material claim, intended-use, output,
alert or product-design change.

The founder also confirmed on August 10, 2026 that the current Pre-order Terms,
Cancellation and Refund Policy, and Privacy Notice require no substantive copy
changes. Delaware records confirm that Frame Wearable, Inc. was incorporated on
August 10, 2026 under file number 10728944. The verified incorporation identity,
Stable-authorised correspondence address, and approved non-draft legal and
product-status versions were inserted on August 11, 2026.

The founder elected on August 10, 2026 to proceed without separate pre-launch
US counsel or cross-border tax-adviser sign-off. This is a recorded owner
decision and does not represent external professional advice or approval.

For the initial US sales-tax posture, the founder confirmed on August 10, 2026
that Frame will have no US office, employees, inventory, warehouse, 3PL, other
physical operations or prior sales contributing to state thresholds when
pre-orders open. The launch plan therefore has no US registrations and collects
no US sales tax initially while retaining tangible-goods classification and
live threshold monitoring. Reassess before any US physical operation,
fulfilment decision or threshold alert. The founder approved Great Britain as
the Stripe Tax head-office country for this operating model and approved tax
policy version `uk-remote-seller-2026-08-09-v1`. The tax lock may use only that
exact version during the controlled incorporation-day launch sequence.

The company-identity work and authorised correspondence address were completed
on August 11, 2026. The matching approved production legal and product-status
versions are legal pack `2026-08-16-v3` and Product Status `2026-08-16-v2`.
Keep the approved tax lock aligned with the production value above.

- Preserve the verified incorporated seller identity, document-matched registered office, and Stable-authorised customer correspondence address. Keep `correspondenceAddressAuthorized` and `MAILING_POSTAL_ADDRESS` aligned with the approved provider record.
- Preserve the founder-approved one-year limited hardware warranty, shipping-delay consent matrix, material-change consent flow, and automatic deadline refund operation unless the founder reopens the legal-page review.
- Preserve the founder-approved provisional fulfilment allowance of $40 per
  order ($30 outbound plus a $10 pooled exception allowance), or replace it with
  a documented final quote. Before inventory is committed or fulfilment begins,
  validate the final packaged dimensions and weight, US fulfilment origin and
  fees against the revalidation triggers in
  `docs/preorder-pre-incorporation-pack.md`; reassess the tax policy before any
  US physical operation or fulfilment decision.
- Preserve the founder-approved provisional battery assumption: one rechargeable
  lithium-ion or lithium-polymer battery, installed in each wearable, expected
  below 20 Wh. Before approving the production battery or handing the first unit
  to a fulfiller, complete every evidence and carrier-acceptance item in the
  provisional battery transport record. Keep returns, damaged devices and
  replacement batteries out of the ordinary outbound workflow until the carrier
  has approved a compliant procedure.
- Keep the founder-approved tangible-goods Stripe product tax code `txcd_99999999` unless the product classification changes.
- Keep `PREORDER_TERMS_VERSION` on approved legal pack `2026-08-16-v3` and the product-status version on `2026-08-16-v2` until substantive copy changes require a new approval.
- Keep `PREORDER_LEGAL_APPROVED_VERSION` set to exactly `2026-08-16-v3`.
- Keep `PREORDER_PRODUCT_STATUS_APPROVED_VERSION` set to exactly `2026-08-16-v2`.
- Re-run the full test suite after the version and copy change.

The application rejects live checkout while the active version begins with `draft` or does not exactly match the configured approval value.

## 4. Live payment and hosted configuration

Create a separate Stripe live Product named `Frame reservation` and a one-time
$99 USD Price. Never reuse the former $299 Price or any test ID in new live
reservation Checkout sessions.

Before private live verification, the live Stripe Account must show the Stripe Services Agreement accepted and live charges and card payments active. By default, it must also show every onboarding detail submitted, payouts enabled with an automatic schedule, and no current, past-due, failed, or pending-verification requirements. If the company payout account alone is still missing or being verified, `PREORDER_ALLOW_BANK_PENDING_LAUNCH=true` may temporarily waive only the external-account, payout-enabled and automatic-schedule checks. Live charges must remain active and every non-bank verification requirement must still be clear; customer proceeds remain in Stripe until the payout account is connected. Its US company name must match `lib/company.ts`; configure the Frame public website, monitored support email and `/contact` URL, merchant category, product description, a 5–22 character statement descriptor containing `FRAME`, and an icon or logo plus primary brand colour. The pre-order Checkout session supplies its own Frame presentation and links the Pre-order Terms, Cancellation and Refund Policy, and Privacy Notice on Stripe's hosted page.

The existing full-payment live objects were created on August 11, 2026 and are
retained only for historical payment verification:

```text
Legacy live Product: prod_V3V9vCQumIgCO9
Legacy $299 live Price: price_1U3OGqCayZz7QEuo8L4htBJr
```

Before releasing the reservation model, create the new live Product and Price,
then record their IDs in the production environment rather than in this file.
The new reservation Price must be the new Product's active default price, be a
one-time $99 USD Price, and have exclusive tax behaviour. The Product must use
the explicit General - Tangible Goods tax code `txcd_99999999` and carry the
`preorder_batch=q1_2027` metadata. Local development must continue using a
separate test reservation Price. Former $299 Price IDs may remain configured
only for verification of historical Checkout Sessions and must never be used by
new reservation checkout.

Current live invariants:

```text
PREORDER_MODE=live
PREORDER_LEGAL_APPROVED_VERSION=2026-08-16-v3
PREORDER_PRODUCT_STATUS_APPROVED_VERSION=2026-08-16-v2
PREORDER_TAX_REVIEW_APPROVED_VERSION=uk-remote-seller-2026-08-09-v1
PREORDER_PREVIEW_MODE=false
PREORDER_LIVE_SMOKE_ACCESS_SECRET=<fourth unique secret of at least 32 characters>
PREORDER_PUBLIC_LAUNCH_ENABLED=true
PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID=<verified fully refunded live-smoke order UUID>
PREORDER_ALLOW_BANK_PENDING_LAUNCH=false
PREORDER_FROM_EMAIL=Frame Pre-orders <preorders@framewearable.com>
PREORDER_OPERATIONS_EMAIL=support@framewearable.com
PREORDER_ORDER_ACCESS_SECRET=<stable dedicated secret of at least 32 characters>
PREORDER_RATE_LIMIT_SECRET=<different dedicated secret of at least 32 characters>
PREORDER_STAGING_ACCESS_SECRET=<different staging secret of at least 32 characters>
STRIPE_SECRET_KEY=<live key>
STRIPE_RESERVATION_PRICE_ID=<live $99 reservation price>
STRIPE_WEBHOOK_SECRET=<live endpoint signing secret>
STRIPE_LIVE_SECRET_KEY=<restricted live key>
STRIPE_LIVE_RESERVATION_PRICE_ID=<live $99 reservation price>
STRIPE_LIVE_WEBHOOK_SECRET=<live endpoint signing secret>
STRIPE_LIVE_WEBHOOK_ENDPOINT_ID=<live endpoint ID>
FRAME_RESERVATION_PRICE_CENTS=9900
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

## 5. Reservation cutover and future releases

Before each Sites publish, commit the exact validated source on `main`, push
`main`, and run `npm run release:check`. Package and publish only that exact
commit.

The August 12, 2026 live smoke covered the legacy $299 full-payment offer. It
must not be reused for the reservation launch. Complete this sequence once for
the $99 reservation, then preserve the resulting live invariants for ordinary
source releases.

1. Configure live mode with `PREORDER_PUBLIC_LAUNCH_ENABLED=false`, an empty `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID`, and a unique `PREORDER_LIVE_SMOKE_ACCESS_SECRET`. Public pre-order routes remain hidden.
2. Keep the Supabase `live` allocation `paused` and set its released-unit ceiling to exactly `1`.
3. Run `npm run preorder:check:email`, `npm run preorder:check:payments`, `npm run preorder:check:operations`, then `npm run preorder:check:live-smoke`; do not continue unless all report zero failures, including every email identity/authentication check, live payment/order comparison, operations-health and inventory check, and live Stripe Account activation, verification, identity, customer-support, descriptor, agreement, and branding check. If `PREORDER_ALLOW_BANK_PENDING_LAUNCH=true`, the only permitted warning is that the payout account and automatic schedule remain pending.
4. Deploy the approved live configuration while the public-launch lock and paused allocation remain in place.
5. Create the 15-minute invitation with `npm run preorder:live-smoke-link`. Do not share it; it opens the real card-payment path for two hours in that browser.
6. From the authenticated owner view, open the one-unit live allocation. The control rejects any larger non-public live opening.
7. Use the invitation to complete one real-card order. Immediately pause the live allocation after Stripe accepts the payment.
8. Verify the charged subtotal, shipping and tax, signed webhook, live order record, delivered confirmation outcome, management link and operational alert. Then issue a full refund and wait until the order shows `refunded` with the full amount reconciled.
9. Copy that live reservation UUID into `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID`, restore the paused released-unit ceiling to `100`, and set `PREORDER_PUBLIC_LAUNCH_ENABLED=true` in the coordinated public-cutover configuration.
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
