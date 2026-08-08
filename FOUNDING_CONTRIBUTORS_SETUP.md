# Frame Founding Contributors — private test setup

The Founding Contributor membership is disabled by default and locked to local
development when explicitly enabled. Its pages, homepage and waitlist sections,
member and policy areas, admin area, APIs, and social image return not found
while the feature is disabled and on every non-loopback host.

## 1. Local-only access

Keep `CONTRIBUTOR_FEATURE_ENABLED=false` for normal local development. Set it
to `true` only while deliberately testing the contributor experience through
`localhost`, `127.0.0.1`, or `[::1]`. The local-only boundary remains in place,
so this flag cannot publish contributor routes on a shared or production host.

`CONTRIBUTOR_PREVIEW_MODE=true` enables sample membership data and simulated
checkout responses only when the feature flag is also enabled on those local
hosts. Keep both flags false in every shared or production environment.

## 2. Prepare Supabase

1. Apply `supabase/migrations/20260803000000_add_founding_contributors.sql` to the existing Frame Supabase project.
2. Add the local development origin and `/contributors/auth/confirm` to Supabase Auth’s permitted redirect URLs.
3. Configure:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The secret key is server-only. The publishable key is used only for passwordless member sign-in. Row-level security is enabled on all contributor tables; private data is returned through token-checked server APIs.

## 3. Prepare Stripe test mode

1. Create a Stripe account and stay in test mode.
2. Create a product named `Frame Founding Contributor Membership`.
3. Create one one-time USD price for **$99.00**. Do not create a recurring price.
4. Configure:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID=price_...
```

5. Forward Stripe test webhooks to the local endpoint:

```text
http://localhost:<local-port>/api/stripe/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `charge.refunded`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.closed`

6. Configure the endpoint signing secret:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

Automatic tax is deliberately disabled in the test checkout. Tax treatment must be decided before live mode.

## 4. Prepare transactional email

Welcome emails use Resend. Configure a verified sender:

```text
RESEND_API_KEY=
CONTRIBUTOR_FROM_EMAIL=Frame <contributors@your-verified-domain>
```

The email includes the contributor number, access dates, sign-in link, membership terms, refund policy, and the reminder that no device was purchased.

## 5. Run the private end-to-end test

Test at least these cases in Stripe test mode:

1. Successful card payment (`4242 4242 4242 4242`).
2. Declined card payment (`4000 0000 0000 9995`).
3. Required membership acknowledgment left unchecked.
4. Stripe Terms acceptance and customer name collection.
5. Successful return page waits for the signed webhook before granting access.
6. Welcome email arrives and its sign-in link works.
7. Passwordless sign-in with the purchase email opens the hub.
8. A different email cannot access that membership.
9. Contributor profile editing, question submission, and advisory vote submission.
10. Duplicate purchase with the same email does not extend access or issue a second founding number, and initiates an automatic full refund without revoking the original membership.
11. Full refund from Stripe revokes access, founding status, and future-discount eligibility.
12. A dispute suspends access; a won dispute restores it.
13. Member, review, success, admin, and API routes do not initialize the Meta Pixel.
14. Desktop and mobile layout, keyboard navigation, and visible focus states.

Use `/admin/contributors` to verify member status, access dates, profile completion, open questions, and published-content counts. Draft member content can be prepared in the Supabase table editor; only rows with `is_published=true` appear in the hub.

## 6. Launch gates

Do not enable live payments or the public feature flag until all of these are complete:

- Replace the legal business name, registered address, and governing-law placeholders.
- Have the Membership Terms, Refund Policy, Product Status Disclosure, and Privacy Notice reviewed and approved.
- Decide the live tax approach and change `automatic_tax` deliberately if required.
- Confirm consumer cancellation/refund handling for every country in scope.
- Test local Supabase redirects, email delivery, Stripe webhooks, refunds, and disputes.
- Set `CONTRIBUTOR_FEATURE_ENABLED=false`.
- Set `CONTRIBUTOR_PREVIEW_MODE=false`.
- Run the full smoke test once more locally.
- Do not remove the local-only route guard or publish any contributor entry
  point without the owner’s explicit instruction. Public launch requires a
  separate reviewed code change; it cannot be enabled by configuration.

No member cap is enforced. The contributor number is an uncapped database identity sequence.
