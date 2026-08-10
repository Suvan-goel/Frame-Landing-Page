# Frame pre-order pre-incorporation pack

Use this document to collect launch decisions and evidence before incorporation.
It supports the canonical [`PREORDER_LAUNCH_RUNBOOK.md`](../PREORDER_LAUNCH_RUNBOOK.md)
but does not replace it.

Do not store identity documents, bank details, API keys, webhook secrets,
personal addresses or other sensitive material in this repository. Record only
the responsible person, approval date, conclusion and a secure evidence
location.

## Current status

- Regulatory review: founder confirmed complete on August 10, 2026; conclusion
  reported as no site-copy changes required.
- Regulatory reviewer and secure evidence location: not recorded here.
- Commercial offer: founder approved the price, expected release price,
  shipping, delivery window, per-checkout quantity, initial allocation, return
  period and warranty terms recorded below on August 10, 2026.
- Legal-page copy review: founder confirmed on August 10, 2026 that the current
  Pre-order Terms, Cancellation and Refund Policy, and Privacy Notice require
  no copy changes.
- Incorporated seller identity: awaiting Stripe Atlas confirmation.
- Final legal-pack release approval: pending insertion of the incorporated
  seller identity and assignment of a non-draft version.
- US sales-tax launch posture: founder confirmed on August 10, 2026 that Frame
  will have no US office, employees, inventory, warehouse, 3PL, other physical
  operations or prior sales contributing to state thresholds when pre-orders
  open. No US registrations or tax collection are planned initially.
- Remaining cross-border tax approval: Stripe Tax head-office country and UK
  corporation-tax, VAT and permanent-establishment treatment remain pending.
- Authorised correspondence address: pending provider approval for the
  incorporated recipient.
- Q1 2027 delivery-basis record: founder waived the separate internal evidence
  record on August 10, 2026. The advertised estimate remains unchanged.
- Public pre-orders: disabled.

Reopen the regulatory review before any material change to product claims,
intended use, outputs, alerts, customer instructions or product design.

## Offer decision record

The application currently enforces this offer consistently across the checkout,
policies, emails, Stripe validation and tests:

- One future Frame device per checkout.
- $299 USD subtotal plus applicable sales tax.
- $499 expected release price.
- Free standard shipping to the 50 states and Washington, DC.
- Estimated shipping in Q1 2027.
- Full one-time payment; no subscription.
- Initial controlled release of 100 units within a 1,000-unit lifetime ceiling.
- Cancellation before processing, a 30-day voluntary return period after
  delivery and a one-year limited hardware warranty.

Record the final decision without changing source until all reviewers are
working from the same offer:

- Owner approval date: August 10, 2026
- Owner-approved scope: $299 plus applicable sales tax; $499 expected release
  price; free standard US shipping; Q1 2027 estimated shipping; one device per
  checkout; initial 100-unit release; 30-day voluntary returns; one-year
  limited hardware warranty.
- Founder legal-page copy approval: August 10, 2026; no copy changes required.
- Final legal-pack release approval date and approver: —
- Tax approval date and approver: —
- Approved legal-pack version: —
- Approved Product Status Disclosure version: —
- Approved tax-policy version: —
- Secure evidence location: —

## Legal review handoff

Provide the reviewer with the rendered Pre-order Terms, Cancellation and Refund
Policy, Product Status Disclosure and Privacy Notice plus the offer decision
above. Record conclusions for:

- Seller identity and customer-facing address labels.
- Order formation and full-payment timing.
- Cancellation, refund and voluntary return promises.
- One-year limited hardware warranty and named warrantor.
- Shipping-delay and material-change consent rules.
- Estimated shipping language and automatic-refund deadlines.
- Governing law and preservation of mandatory consumer rights.
- Privacy controller identity, international transfers and retention.

Review record:

- Reviewer: founder
- Scope: current Pre-order Terms, Cancellation and Refund Policy, and Privacy
  Notice. The Product Status Disclosure is covered by the separately completed
  regulatory review.
- Approval date: August 10, 2026
- Required copy changes: none to the reviewed copy. Incorporated seller name,
  registration, registered-office, authorised correspondence-address,
  privacy-controller and named-warrantor values remain to be inserted from the
  issued and approved company records.
- Secure evidence location: —

## Cross-border tax handoff

Ask the adviser to decide, using the actual operating and fulfilment facts:

- Whether Great Britain is the correct Stripe Tax head-office country.
- The physical ship-from location and its consequences.
- Whether any US sales-tax registration is required at launch.
- How and when economic-nexus thresholds will be monitored.
- UK corporation-tax, VAT and permanent-establishment treatment.
- Whether Stripe tax code `txcd_99999999` remains appropriate.
- Whether $299 tax-exclusive pricing and free shipping are configured correctly.

Tax record:

- Adviser: no external adviser recorded; founder confirmed the launch operating
  facts and approved the initial US sales-tax posture.
- Owner confirmation date: August 10, 2026
- Stripe Tax head-office country: Great Britain is the current application
  assumption; final cross-border confirmation remains pending.
- Ship-from location: not yet selected. Reassess before placing inventory with
  any manufacturer, warehouse or 3PL.
- US registration states at launch: none, based on the confirmed absence of US
  physical operations and prior threshold sales.
- Threshold monitoring: keep Stripe Tax live-mode threshold monitoring enabled;
  review its alerts throughout the pre-order period and before any US physical
  operation or fulfilment decision.
- Source policy matching the zero-registration posture:
  `uk-remote-seller-2026-08-09-v1`.
- Approved cross-border tax-policy version: —
- Secure evidence location: —

The product remains classified as tangible goods; the absence of registrations
must not be implemented by marking it tax-exempt. Do not add a registration or
set `PREORDER_TAX_REVIEW_APPROVED_VERSION` until the remaining head-office and
cross-border conclusions are documented. Reassess immediately if the confirmed
launch facts change.

## Q1 2027 delivery-basis decision

- Decision owner: founder
- Decision date: August 10, 2026
- Decision: skip the separate internal delivery-basis evidence record.
- Advertised estimate: Q1 2027, unchanged.

This decision removes the evidence record as an internal launch prerequisite.
It does not change the existing customer-facing delay notices, consent,
cancellation or automatic-refund safeguards.

## Incorporation-day data sheet

Copy values from issued documents. Do not infer or abbreviate them.

- Exact legal company name: —
- Entity type: —
- Delaware registration or file number: —
- Jurisdiction wording: —
- Registered office line 1: —
- Registered office line 2: —
- Registered office locality: —
- Registered office region: —
- Registered office postal code: —
- Registered office country: —
- Stable incorporated-recipient approval date: —
- Authorised correspondence address: —
- `MAILING_POSTAL_ADDRESS` confirmed to match: —
- Stripe representative verification complete: —
- Business bank account connected: —

After verification, enter the identity once in `lib/company.ts`. The warranty
provider and privacy controller derive from the legal name. Set
`correspondenceAddressAuthorized` to `true` only after the mail provider has
approved the incorporated entity.

## Stripe activation record

Record state, not credentials:

- All onboarding details submitted: —
- Services Agreement accepted: —
- Live charges enabled: —
- Card capability active: —
- Payouts enabled with automatic schedule: —
- No current, past-due or pending-verification requirements: —
- Legal identity matches `lib/company.ts`: —
- Website, merchant category and product description complete: —
- Support email and `/contact` URL complete: —
- Statement descriptor contains `FRAME`: —
- Logo/icon and primary colour configured: —
- Restricted live key stored in hosting: —
- Live Product, Price, tax settings and webhook verified: —

The real-card private smoke order and full refund remain mandatory after these
items are complete and before public inventory can open.
