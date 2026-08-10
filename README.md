# Frame website

The public website, waitlist and pre-order operations application for Frame
Health Technologies. It runs on vinext and Cloudflare Workers and uses Supabase,
Stripe and Resend for authenticated administration, commerce and transactional
email.

## Prerequisites

- Node.js `>=22.13.0`

## Local development

```bash
npm install
npm run dev
```

Keep local development in Stripe test mode. Public pre-order access is guarded
independently by approved policy versions, a public-launch switch, a verified
live-smoke order and the live inventory allocation.

## Project structure

- `app/`: public pages, pre-order flow, owner interfaces and API routes.
- `lib/`: company, policy, commerce, email and operational domain logic.
- `worker/`: public routing gates, canonical-host handling and scheduled work.
- `supabase/`: database migrations and operational functions.
- `scripts/`: read-only readiness checks, controlled reliability tests and
  creative generation.
- `tests/`: rendered, security, commerce, email and operational regression
  coverage.

## Verification

```bash
npm test
npm run lint
npm run preorder:test:visibility
npm run preorder:check:email
npm run preorder:check:payments:test
npm run preorder:check:operations:test
```

`npm run preorder:test:reliability` performs controlled temporary writes only
in the test allocation and restores its synthetic records. Live payment and
operations checks are read-only; the private real-card smoke order is a separate
manual cutover step.

## Pre-order launch

- Canonical procedure: [`PREORDER_LAUNCH_RUNBOOK.md`](PREORDER_LAUNCH_RUNBOOK.md)
- Approval and handoff template:
  [`docs/preorder-pre-incorporation-pack.md`](docs/preorder-pre-incorporation-pack.md)
- Runtime-variable template: [`.env.example`](.env.example)

`main` is the only publishable branch. Before packaging or publishing, push
`main` and run `npm run release:check`; the packaged commit must exactly match
local `main` and `origin/main`.
