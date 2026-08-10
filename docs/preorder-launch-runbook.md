# Frame pre-order launch runbook

Status: launch candidate. Public access and live checkout must remain disabled until every cutover item is complete.

## Reviewed offer

- Product: one future Frame device per checkout
- Product subtotal: $299 USD
- Standard US shipping: free
- Applicable sales tax: additional and calculated at checkout
- Initial territory: the 50 United States and Washington, DC; no territories or international shipping
- Estimated shipping: Q1 2027
- Lifetime inventory ceiling: 1,000 units
- Initial controlled release: 100 units
- Payment: full one-time payment at checkout; no recurring charge

## Current launch locks

- `PREORDER_MODE` remains `test` or `off` outside the final cutover.
- `PREORDER_TERMS_VERSION` and `PREORDER_PRODUCT_STATUS_VERSION` remain draft versions.
- `PREORDER_SELLER_DETAILS_COMPLETE` remains `false` until the incorporated seller details are in every policy.
- `PREORDER_LEGAL_APPROVED_VERSION` remains empty until the final policy version is deliberately activated.
- `PREORDER_TAX_REVIEW_APPROVED_VERSION` remains empty until the UK-head-office remote-seller tax policy is deliberately approved.
- The live allocation remains paused.
- Public pre-order routes return 404 and the homepage contains no pre-order link.

## Before incorporation is approved

- Keep the launch candidate policies, checkout, emails, order management, refund processing, delay response, inventory controls, and tests current.
- Keep all public pre-order routes closed.
- Maintain documentary support for the Q1 2027 shipping estimate: development milestones, validation plan, supplier/manufacturer lead times, quality work, expected demand, fulfilment capacity, and contingency time.
- Keep the actual UK operating address as the private Stripe Tax head office until a physical-goods ship-from location is selected. Do not publish the founder's home address as the customer correspondence address.
- The public seller and customer-correspondence address has been reserved through Stable: `2810 N Church St, STE 89620, Wilmington, DE 19802, United States`. Complete and verify the USPS Form 1583 mail authorization, register the incorporated legal name as a recipient when Atlas confirms it, and do not publish the address before incorporation is approved. Treat it as a correspondence address, not the Delaware registered office, physical headquarters, actual principal place of business, or UK operating address.
- Obtain cross-border tax advice. Do not enable a US tax registration without a documented basis, and keep Stripe Tax threshold monitoring active as paid pre-orders accumulate.
- Confirm that `support@framewearable.com` receives customer replies and operational alerts. Transactional sender addresses may remain send-only because every automated email uses `support@framewearable.com` as its reply address.
- Run `npm run preorder:check:email`. It performs a read-only check of the exact pre-order sender, support routing, inbound MX, root SPF, Resend DKIM and return-path SPF/MX, and enforced DMARC policy. It neither sends mail nor changes DNS or Resend, and it works with a restricted sending-only Resend credential.
- Run `npm run preorder:check:payments:test` after checkout, refund, dispute or webhook changes. It compares paid Stripe test sessions with the stored checkout, order and payment records without moving money or updating data. The live form is `npm run preorder:check:payments`; its key needs read access to Checkout Sessions, PaymentIntents, Charges, Refunds and Disputes.

## After incorporation is approved

1. Enter the exact company name, registration number, registered office, jurisdiction, and support details once in `lib/company.ts`. The registered-office and public correspondence-address fields are already wired separately through the site footer, pre-order checkout review, Pre-order Terms, Cancellation and Refund Policy, Product Status Disclosure, Privacy Notice, structured data, and applicable customer/marketing email identity. After the USPS Form 1583 approval and Atlas incorporation confirmation, enter the reserved Stable address (`2810 N Church St, STE 89620, Wilmington, DE 19802, United States`) as the correspondence address and set `correspondenceAddressAuthorized` to `true`. Also set `MAILING_POSTAL_ADDRESS` to the authorised correspondence address in the hosted environment. Keep the Delaware registered office and Stable correspondence address accurately labelled and distinct. Confirm all incorporated details match the issued documents before publishing either identity.
2. Complete Stripe live-account verification, representative details, bank account, automatic payout schedule, business profile, support email and URL, recognisable `FRAME` statement descriptor, Stripe Services Agreement acceptance, and merchant icon/logo and primary brand colour.
3. Create or rotate a least-privilege live Stripe key and configure `STRIPE_LIVE_SECRET_KEY` in the deployment environment. It must retain the existing checkout/refund/tax/webhook permissions and read access to the Account object so the launch checks can verify charges, payouts, KYC requirements, profile, descriptor, agreement acceptance, and branding without modifying Stripe.
4. Reveal the existing live webhook signing secret and configure `STRIPE_LIVE_WEBHOOK_SECRET` in the deployment environment.
5. Confirm the live $299 price, free standard US shipping, exclusive tax behaviour, product tax code, and required webhook event set.
6. Confirm the UK-head-office remote-seller tax policy and configure only the registrations supported by the accountant's conclusion. Set `PREORDER_TAX_REVIEW_APPROVED_VERSION` to the exact policy version only after that review.
7. Change the policy versions to a dated, non-draft release, set `PREORDER_SELLER_DETAILS_COMPLETE` to `true`, and set `PREORDER_LEGAL_APPROVED_VERSION` to exactly the same terms version.
8. Configure `PREORDER_MODE=live`, a unique `PREORDER_LIVE_SMOKE_ACCESS_SECRET`, `PREORDER_PUBLIC_LAUNCH_ENABLED=false`, and an empty `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID`. Deploy while the live allocation is paused and public pre-order routes remain hidden.
9. Set the paused live released-unit ceiling to exactly one, run `npm run preorder:check:email`, `npm run preorder:check:payments`, then `npm run preorder:check:live-smoke`; do not continue unless all report zero failures. The checks must confirm email identity and authentication, exact payment/order reconciliation, plus `charges_enabled`, `payouts_enabled`, active card capability, no current/past/pending verification requirements, the incorporated legal identity, customer-support profile, statement descriptor, automatic payout schedule, agreement acceptance, and Stripe branding.
10. Generate the short-lived private invitation with `npm run preorder:live-smoke-link`, open the one-unit allocation from the owner view, and place one controlled real-card order. Pause immediately after payment.
11. Verify the charged subtotal, shipping and tax, signed webhook, live order record, confirmation and operations emails, and secure management link. Issue a full refund and wait for the reconciled `refunded` state.
12. Set `PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID` to that pre-order UUID, restore the paused live ceiling to 100, and set `PREORDER_PUBLIC_LAUNCH_ENABLED=true` in the coordinated public-cutover configuration.
13. Run `npm run preorder:check:payments` again, then `npm run preorder:check:launch`; they must reconcile and verify the exact private live order with zero failures. Confirm there are no failed webhooks, failed emails, pending cancellations, payment mismatches, or inventory discrepancies.
14. Publish the public-cutover configuration and open the 100-unit live allocation from the authenticated owner view.

## First-order monitoring

For the first order, confirm all of the following before allowing more traffic:

- Stripe Checkout charged the expected product, shipping, and applicable tax.
- Exactly one paid order and one inventory unit were recorded.
- The accepted terms and product-status versions match the active versions.
- The confirmation email arrived and its management link works.
- The signed webhook was processed exactly once.
- The operations dashboard shows the order and has no failed email or webhook alert.

Pause the live allocation immediately if any item fails. Webhook fulfilment and refunds remain available while sales are paused.

## Pre-dispatch cancellation procedure

1. A customer cancels through the signed order-management link or support.
2. The order is blocked from shipment while the cancellation is pending.
3. Submit the full remaining refund, including product, shipping, and collected tax, as soon as possible and no later than seven working days after cancellation.
4. Confirm the Stripe refund event updates the payment and order records and sends the customer status email.
5. Investigate any failed refund immediately; do not mark the cancellation complete until the payment state is reconciled.

## Shipping-delay procedure

1. Before the current estimate expires, record the reason and a revised shipping estimate supported by the latest plan. If no definite estimate can be supported, say so and explain why.
2. Send the built-in delivery update. It gives the customer a free way to accept the update or request cancellation.
3. Track the customer's recorded response. If affirmative consent is required and is not received by the notice deadline, cancel and issue a full refund.
4. Repeat the notice-and-response process for any further delay.
5. Keep the supporting plan, notices, responses, cancellations, and refunds as order audit records.

## Product-claim control

- The founder has chosen to proceed without a separate medical-device regulatory specialist review.
- Do not represent Frame as FDA cleared, approved, or authorized.
- Do not claim validated accuracy or performance until the supporting validation exists.
- Keep all intended-use, instructions, promotional material, checkout copy, and customer communications consistent with the stated general-wellness and non-medical-use positioning.
- Reassess before any claim, intended use, output, alert, or product design change that moves toward diagnosis, disease monitoring, treatment, medication decisions, emergencies, or clinical use.
