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
- The live allocation remains paused.
- Public pre-order routes return 404 and the homepage contains no pre-order link.

## Before incorporation is approved

- Keep the launch candidate policies, checkout, emails, order management, refund processing, delay response, inventory controls, and tests current.
- Keep all public pre-order routes closed.
- Maintain documentary support for the Q1 2027 shipping estimate: development milestones, validation plan, supplier/manufacturer lead times, quality work, expected demand, fulfilment capacity, and contingency time.
- Decide the ship-from location and obtain cross-border tax advice. Do not enable a US tax registration without a documented basis.
- Confirm that `support@framewearable.com`, the transactional sender, and the operations inbox can receive replies and alerts.

## After incorporation is approved

1. Enter the exact company name, registration number, registered office, jurisdiction, and support details once in `lib/company.ts`. Confirm the generated Pre-order Terms, Cancellation and Refund Policy, Product Status Disclosure, Privacy Notice, structured data, and email identity all match the incorporation documents.
2. Complete Stripe live-account verification, representative details, bank account, business profile, and terms acceptance.
3. Create or rotate a least-privilege live Stripe key and configure `STRIPE_LIVE_SECRET_KEY` in the deployment environment.
4. Reveal the existing live webhook signing secret and configure `STRIPE_LIVE_WEBHOOK_SECRET` in the deployment environment.
5. Confirm the live $299 price, free standard US shipping, exclusive tax behaviour, product tax code, and required webhook event set.
6. Resolve the sales-tax position and configure only the registrations supported by the accountant's conclusion.
7. Change the policy versions to a dated, non-draft release, set `PREORDER_SELLER_DETAILS_COMPLETE` to `true`, and set `PREORDER_LEGAL_APPROVED_VERSION` to exactly the same terms version.
8. Deploy behind private staging access while the live allocation remains paused.
9. Run `npm run preorder:check:launch`; do not continue unless it reports zero failures and zero warnings.
10. Place one controlled live order, verify the charged subtotal, shipping and tax, confirm the order record and emails, test the secure management link, then issue and verify a full refund.
11. Re-run the launch check and confirm there are no failed webhooks, failed emails, pending cancellations, or inventory discrepancies.
12. Open the 100-unit live allocation, switch the runtime to live, and publish the homepage CTA in one coordinated deployment.

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
