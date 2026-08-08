import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isStripeWebhookRecoveryEligible,
  STRIPE_WEBHOOK_STALE_AFTER_SECONDS,
} from "../lib/stripe-webhook-recovery.ts";
import {
  preorderConfirmationRecovery,
  preorderItemDescription,
  preorderShippingAddressLines,
  publicPreorderShippingAddress,
} from "../lib/preorder-confirmation.ts";

test("keeps webhook verification and paid fulfilment independent from the sales switch", async () => {
  const [stripeServer, payments, worker] = await Promise.all([
    readFile(new URL("../lib/stripe.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-payments.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(stripeServer, /\["live", "test", null\]/);
  assert.doesNotMatch(payments, /getPreorderMode|Pre-order fulfilment is disabled/);
  assert.match(worker, /isSharedStripeWebhook && request\.method !== "POST"/);
  assert.doesNotMatch(
    worker,
    /isSharedStripeWebhook && !preorderRequestAllowed/,
  );
});

test("queues signed events after a durable claim and tracks modern refund events", async () => {
  const [webhook, processing, readiness] = await Promise.all([
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/stripe-webhook-processing.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(webhook, /beginStripeWebhookEvent/);
  assert.match(webhook, /executionContext\.waitUntil\(processingTask\)/);
  assert.match(webhook, /status: 202/);
  assert.match(processing, /case "refund\.created"/);
  assert.match(processing, /case "refund\.updated"/);
  assert.match(processing, /stripe\.charges\.retrieve/);
  assert.match(readiness, /"refund\.created"/);
  assert.match(readiness, /"refund\.updated"/);
});

test("makes failed and stale background events recoverable", () => {
  const now = Date.parse("2026-08-06T12:00:00.000Z");
  const staleAt = new Date(
    now - STRIPE_WEBHOOK_STALE_AFTER_SECONDS * 1_000 - 1,
  ).toISOString();
  const freshAt = new Date(now - 1_000).toISOString();

  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "failed", lastAttemptedAt: freshAt, now }),
    true,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processing", lastAttemptedAt: staleAt, now }),
    true,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processing", lastAttemptedAt: freshAt, now }),
    false,
  );
  assert.equal(
    isStripeWebhookRecoveryEligible({ status: "processed", lastAttemptedAt: staleAt, now }),
    false,
  );
});

test("keeps the reviewed subtotal, shipping, tax and inventory controls explicit", async () => {
  const [checkout, offer, migration, initialRelease, readiness] = await Promise.all([
    readFile(new URL("../app/api/preorders/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260807000000_add_preorder_inventory_ceiling.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260807010000_set_initial_preorder_release.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(offer, /PREORDER_DEFAULT_PRICE_CENTS = 29_900/);
  assert.match(offer, /PREORDER_RELEASE_PRICE_CENTS = 49_900/);
  assert.match(offer, /PREORDER_SHIPPING_RATE_CENTS = 1_900/);
  assert.match(offer, /PREORDER_ESTIMATED_SHIPPING = "Q1 2027"/);
  assert.match(offer, /PREORDER_MAX_INVENTORY_UNITS = 1_000/);
  assert.match(checkout, /shipping_options:/);
  assert.match(checkout, /stripe\.customers\.create/);
  assert.match(checkout, /customer: stripeCustomer\.id/);
  assert.doesNotMatch(checkout, /shipping_address_collection:/);
  assert.match(checkout, /amount: config\.shippingRateCents/);
  assert.match(checkout, /config\.shippingRateCents !== PREORDER_SHIPPING_RATE_CENTS/);
  assert.match(checkout, /automatic_tax: \{ enabled: true \}/);
  assert.match(checkout, /adaptive_pricing: \{ enabled: false \}/);
  assert.match(checkout, /price\.tax_behavior !== "exclusive"/);
  assert.match(checkout, /PREORDER_CHECKOUT_SESSION_TTL_SECONDS/);
  assert.match(checkout, /expires_at:/);
  assert.match(checkout, /select\("stripe_checkout_session_id, updated_at"\)/);
  assert.match(checkout, /stripe\.checkout\.sessions\.retrieve\(existingSessionId\)/);
  assert.match(checkout, /existingSession\.status === "open" && existingSession\.url/);
  assert.match(checkout, /const sessionExpiresAt/);
  assert.match(checkout, /branding_settings:/);
  assert.match(checkout, /legalBaseUrl = mode === "test" \? requestOrigin : SITE_URL/);
  assert.match(
    checkout,
    /\[Frame Pre-order Terms\]\(\$\{legalBaseUrl\}\/preorder\/terms\)/,
  );
  assert.match(
    checkout,
    /\[Cancellation and Refund Policy\]\(\$\{legalBaseUrl\}\/preorder\/refunds\)/,
  );
  assert.match(migration, /inventory_limit = 1000/);
  assert.match(migration, /unit_limit <= inventory_limit/);
  assert.match(initialRelease, /sales_status = 'paused'/);
  assert.match(initialRelease, /unit_limit = 100/);
  assert.match(readiness, /reviewed \$19 USD rate/i);
});

test("allows only the 50 states and Washington DC for launch shipping", async () => {
  const { isAllowedPreorderUsState, PREORDER_US_STATE_OPTIONS } = await import(
    "../lib/preorder-shipping.ts"
  );

  assert.equal(PREORDER_US_STATE_OPTIONS.length, 51);
  assert.equal(isAllowedPreorderUsState("NJ"), true);
  assert.equal(isAllowedPreorderUsState("dc"), true);
  for (const territory of ["PR", "GU", "VI", "AS", "MP", "FM", "MH", "PW", "AA", "AE", "AP"]) {
    assert.equal(isAllowedPreorderUsState(territory), false);
  }
});

test("keeps checkout review recovery, consent feedback, and proxy origins safe", async () => {
  const [review, success, draft, route, draftHelpers] = await Promise.all([
    readFile(new URL("../app/components/preorder-checkout-review.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/preorder-success.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-checkout-draft.ts", import.meta.url), "utf8"),
    import("../lib/request-origin.server.ts"),
    import("../lib/preorder-checkout-draft.ts"),
  ]);

  assert.match(draft, /frame-preorder-delivery-v1/);
  assert.match(draft, /frame-preorder-request-v1/);
  assert.match(review, /sessionStorage\.setItem/);
  assert.match(review, /sessionStorage\.getItem/);
  assert.match(review, /requestKey\.current = null/);
  assert.match(success, /sessionStorage\.removeItem/);
  assert.match(review, /productStatusCheckbox\.current\?\.focus/);
  assert.match(review, /termsCheckbox\.current\?\.focus/);
  assert.match(review, /aria-invalid/);

  const proxied = new Request("http://localhost:3000/api/preorders/checkout", {
    headers: { host: "localhost:3002", origin: "http://localhost:3002" },
  });
  const crossSite = new Request("https://framewearable.com/api/preorders/checkout", {
    headers: { origin: "https://malicious.example" },
  });
  assert.equal(route.verifiedRequestOrigin(proxied), "http://localhost:3002");
  assert.equal(route.verifiedRequestOrigin(crossSite), null);

  const delivery = {
    email: "alex@example.com",
    fullName: "Alex Morgan",
    line1: "1450 Market Street",
    line2: "",
    city: "San Francisco",
    state: "CA",
    postalCode: "94102",
  };
  const savedAt = 1_000_000;
  const serialized = draftHelpers.serializePreorderDeliveryDraft(delivery, savedAt);
  assert.deepEqual(draftHelpers.parsePreorderDeliveryDraft(serialized, savedAt + 1_000), delivery);
  assert.equal(
    draftHelpers.parsePreorderDeliveryDraft(
      serialized,
      savedAt + draftHelpers.PREORDER_DELIVERY_DRAFT_MAX_AGE_MS + 1,
    ),
    null,
  );
  assert.equal(draftHelpers.parsePreorderDeliveryDraft("not-json", savedAt), null);
  const requestKey = "00000000-0000-4000-8000-000000000001";
  const serializedRequestKey = draftHelpers.serializePreorderCheckoutRequestKey(
    requestKey,
    savedAt,
  );
  assert.equal(
    draftHelpers.parsePreorderCheckoutRequestKey(serializedRequestKey, savedAt + 1_000),
    requestKey,
  );
  assert.equal(
    draftHelpers.parsePreorderCheckoutRequestKey(
      serializedRequestKey,
      savedAt + draftHelpers.PREORDER_DELIVERY_DRAFT_MAX_AGE_MS + 1,
    ),
    null,
  );
});

test("keeps launch-candidate policies aligned with cancellation operations", async () => {
  const [terms, refunds, productStatus, ownerOperations, ownerInterface, customerInterface] =
    await Promise.all([
      readFile(new URL("../app/preorder/terms/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/preorder/refunds/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/preorder/product-status/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/admin/preorders/[id]/operations/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/preorder-order-operations.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/components/preorder-manage.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(terms, /cancel for any reason until fulfilment begins/);
  assert.match(terms, /full refund/);
  assert.match(terms, /Frame One-Year Limited Warranty/);
  assert.match(terms, /first delay with a definite revised shipping date no more than 30 days later/);
  assert.match(terms, /material change by that deadline/);
  assert.match(refunds, /no later\s+than seven\s+working days/);
  assert.match(refunds, /30 calendar days after delivery/);
  assert.match(refunds, /original\s+promised shipping time/);
  assert.match(refunds, /brief indoor try-on/);
  assert.match(refunds, /replacement or refund at no additional cost/);
  assert.match(refunds, /Frame One-Year Limited/);
  assert.doesNotMatch(refunds, /submit a required pre-dispatch refund to Stripe/);
  assert.match(productStatus, /Performance has not been established/);
  assert.match(productStatus, /has not received FDA marketing/);
  assert.match(productStatus, /version you accept will be recorded/);
  assert.doesNotMatch(ownerOperations, /decline_cancellation/);
  assert.doesNotMatch(ownerInterface, /declineCancellation|decline_cancellation/);
  assert.match(ownerInterface, /no later than seven working days/);
  assert.match(customerInterface, /full remaining amount/);
  assert.match(customerInterface, /silence is treated as consent to this short delay/);
  assert.match(ownerInterface, /Material product change/);
});

test("enforces the approved response policy for shipping delays and material changes", async () => {
  const {
    canSendPreorderDeliveryNotice,
    deliveryResponseModeForNotice,
    preorderDeliveryResponseExpired,
    validPreorderDeliveryResponseDeadline,
  } = await import("../lib/preorder-delivery-policy.ts");

  assert.equal(deliveryResponseModeForNotice("first_short_delay"), "silence_is_consent");
  assert.equal(
    deliveryResponseModeForNotice("consent_required_delay"),
    "affirmative_consent_required",
  );
  assert.equal(
    deliveryResponseModeForNotice("material_product_change"),
    "affirmative_consent_required",
  );
  assert.equal(
    canSendPreorderDeliveryNotice({ currentVersion: 0, noticeType: "first_short_delay" }),
    true,
  );
  assert.equal(
    canSendPreorderDeliveryNotice({ currentVersion: 1, noticeType: "first_short_delay" }),
    false,
  );

  const now = new Date("2026-08-08T12:00:00.000Z");
  assert.equal(
    validPreorderDeliveryResponseDeadline({
      responseMode: "affirmative_consent_required",
      responseDeadline: "2026-08-22T12:00:00.000Z",
      now,
    }),
    true,
  );
  assert.equal(
    validPreorderDeliveryResponseDeadline({
      responseMode: "affirmative_consent_required",
      responseDeadline: "2026-09-20T12:00:00.000Z",
      now,
    }),
    false,
  );
  assert.equal(
    preorderDeliveryResponseExpired({
      responseMode: "affirmative_consent_required",
      responseDeadline: "2026-08-08T11:59:59.000Z",
      now,
    }),
    true,
  );
  assert.equal(
    preorderDeliveryResponseExpired({
      responseMode: "silence_is_consent",
      responseDeadline: null,
      now,
    }),
    false,
  );
});

test("verifies an authenticated email change before rotating order access", async () => {
  const [manageRoute, emailChangeRoute, customerManagement, customerInterface, access] = await Promise.all([
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/preorders/manage/email-change/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/preorder-customer-management.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/components/preorder-manage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-order-access.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(manageRoute, /action === "request_email_change"/);
  assert.match(manageRoute, /payload\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(manageRoute, /EMAIL_PATTERN\.test\(email\)/);
  assert.match(customerManagement, /requestPreorderContactEmailChange/);
  assert.match(customerManagement, /confirmPreorderContactEmailChange/);
  assert.match(customerManagement, /normalized_email: payload\.newEmail/);
  assert.match(customerManagement, /manage_token_version: nextTokenVersion/);
  assert.match(customerManagement, /contact_email_updated/);
  assert.match(customerManagement, /audience: "previous"/);
  assert.match(emailChangeRoute, /notice=email-updated/);
  assert.match(access, /EMAIL_CHANGE_TOKEN_TTL_SECONDS = 30 \* 60/);
  assert.match(access, /kind: "email_change"/);
  assert.match(customerInterface, /Confirm new email address/);
  assert.match(customerInterface, /Send verification email/);
  assert.match(customerInterface, /Marketing preferences are unchanged/);
});

test("hardens order management actions, addresses, state refresh, and private metadata", async () => {
  const [manageRoute, customerManagement, customerInterface, page, worker] = await Promise.all([
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-customer-management.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/preorder-manage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/preorder/manage/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(manageRoute, /const action = typeof payload\.action === "string" \? payload\.action : ""/);
  assert.match(manageRoute, /VALID_ACTIONS\.has\(action\)/);
  assert.doesNotMatch(manageRoute, /: "request_cancellation"/);
  assert.match(manageRoute, /isAllowedPreorderUsState\(shippingAddress\.state\)/);
  assert.match(manageRoute, /US_ZIP_PATTERN\.test\(shippingAddress\.postal_code\)/);
  assert.match(customerManagement, /amount_refunded/);
  assert.match(customerManagement, /amountRefunded:/);
  assert.match(customerInterface, /if \(next\.order\)/);
  assert.match(customerInterface, /preorder-manage-feedback/);
  assert.match(customerInterface, /autoComplete="shipping address-line1"/);
  assert.match(customerInterface, /Preparing for shipment/);
  assert.match(customerInterface, /Refund needs attention/);
  assert.match(customerInterface, /Need help with this shipment/);
  assert.match(customerInterface, /topic=preorder/);
  assert.doesNotMatch(customerInterface, /topic=general/);
  assert.match(page, /canonical: "\/preorder\/manage"/);
  assert.match(page, /referrer: "no-referrer"/);
  assert.match(worker, /url\.pathname === "\/preorder\/manage"[\s\S]*?"no-referrer"/);
});

test("provides realistic local order-management preview states", async () => {
  const [preview, route, status] = await Promise.all([
    readFile(new URL("../lib/preorder-manage-preview.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/status/route.ts", import.meta.url), "utf8"),
  ]);

  for (const state of [
    "active",
    "processing",
    "short-delay",
    "delay",
    "material",
    "address-pending",
    "cancellation-pending",
    "refund-pending",
    "refund-failed",
    "cancelled",
    "shipped",
    "delivered",
  ]) {
    assert.match(preview, new RegExp(`"${state}"`));
  }
  assert.match(preview, /"refund_failed"/);
  assert.match(preview, /trackingNumber: "1Z999AA10123456784"/);
  assert.match(preview, /status: "email_verification_sent"/);
  assert.match(preview, /status: "address_change_requested"/);
  assert.match(route, /preorderManagePreviewOrder/);
  assert.match(route, /preorderManagePreviewMutation/);
  assert.match(status, /managePath: "\/preorder\/manage\?preview=1"/);
});

test("gives every pre-order confirmation outcome an accurate recovery path", () => {
  const invalid = preorderConfirmationRecovery({ status: "invalid" });
  assert.equal(invalid.heading, "We couldn’t find this confirmation.");
  assert.deepEqual(invalid.primaryAction, {
    kind: "link",
    label: "Return to pre-order",
    href: "/preorder/review",
  });

  for (const status of ["expired", "unpaid"]) {
    const payment = preorderConfirmationRecovery({ status });
    assert.equal(payment.heading, "Your pre-order wasn’t completed.");
    assert.equal(payment.primaryAction.kind, "link");
  }

  for (const status of ["unavailable", "rate_limited", "unexpected"]) {
    assert.equal(preorderConfirmationRecovery({ status }).primaryAction.kind, "retry");
  }
});

test("formats confirmation quantities and exposes only a clean shipping address", () => {
  assert.equal(preorderItemDescription(1), "one Frame");
  assert.equal(preorderItemDescription(2), "2 Frames");

  const address = publicPreorderShippingAddress({
    line1: " 1450 Market Street ",
    line2: "",
    city: " San Francisco ",
    state: "CA",
    postal_code: "94102",
    country: "US",
    unrelated_private_field: "not returned",
  });
  assert.deepEqual(address, {
    line1: "1450 Market Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94102",
    country: "US",
  });
  assert.deepEqual(preorderShippingAddressLines(address), [
    "1450 Market Street",
    "San Francisco, CA 94102",
    "United States",
  ]);
  assert.equal(publicPreorderShippingAddress({ city: "Rome" }), null);
});

test("wires the production confirmation page to the reviewed metadata and accessible states", async () => {
  const [page, component, statusRoute] = await Promise.all([
    readFile(new URL("../app/preorder/success/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/preorder-success.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/status/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /title: "Frame pre-order confirmation"/);
  assert.match(page, /canonical: "\/preorder\/success"/);
  assert.match(page, /index: false, follow: false/);
  assert.match(component, /Confirming payment/);
  assert.match(component, /className="sr-only" role="status" aria-live="polite"/);
  assert.match(component, /className="preorder-confirmation__state-copy" role="alert"/);
  assert.match(component, /topic=preorder/);
  assert.doesNotMatch(component, /topic=general/);
  assert.match(component, /Shipping to/);
  assert.match(component, /href="\/preorder\/product-status">Product status/);
  assert.doesNotMatch(component, /Important product status|Frame remains under development/);
  assert.match(statusRoute, /status: "invalid"/);
  assert.match(statusRoute, /status: "rate_limited"/);
  assert.match(statusRoute, /status: "unavailable"/);
  assert.match(statusRoute, /shipping_address/);
});
