import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { formatName } from "../lib/name-format.ts";
import {
  RESEARCH_CALL_OPTIONS,
  normalizeResearchCallValue,
} from "../lib/waitlist-options.ts";
import {
  captureWaitlistEmail,
  completeWaitlistQualification,
  recordWaitlistPreorderDecline,
  skipWaitlistQualification,
} from "../lib/waitlist-service.server.ts";
import { resolveAdminTimeZone } from "../lib/admin-time-zone.ts";
import {
  isSupabaseJwtIssuedAtFutureError,
  retrySupabaseReadOnJwtIssuedAtFuture,
} from "../lib/supabase-retry.ts";
import {
  effectiveTrackingConsent,
  trackingPolicyForRegion,
} from "../lib/tracking-policy.ts";

function createWaitlistRepositoryFixture() {
  const records = [];
  let nextId = 1;
  const repository = {
    async findByEmail(email) {
      return records.find((record) => record.email === email) ?? null;
    },
    async insert(input) {
      const record = {
        id: nextId++,
        email: input.email,
        signupToken: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
        metaEventId: `10000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
        createdAt: "2026-08-10T12:00:00.000Z",
        qualificationStatus: "not_started",
        surveyCompletedAt: null,
        qualification: null,
        attribution: input,
      };
      records.push(record);
      return record;
    },
    async resubscribe(id) {
      const record = records.find((candidate) => candidate.id === id);
      if (record) record.unsubscribedAt = null;
    },
    async findByToken(signupToken) {
      return records.find((record) => record.signupToken === signupToken) ?? null;
    },
    async findMetaLeadByEventId(metaEventId) {
      const record = records.find(
        (candidate) => candidate.metaEventId === metaEventId,
      );
      return record
        ? {
            metaEventId: record.metaEventId,
            email: record.email,
            metaClickId: record.attribution.metaClickId,
            createdAt: record.createdAt,
            metaCapiStatus: "not_attempted",
          }
        : null;
    },
    async updateMetaTrackingDiagnostics() {},
    async markSkipped(id, skippedAt) {
      const record = records.find((candidate) => candidate.id === id);
      record.qualificationStatus = "skipped";
      record.skippedAt = skippedAt;
    },
    async completeIfIncomplete(id, update) {
      const record = records.find((candidate) => candidate.id === id);
      if (record.surveyCompletedAt || record.qualificationStatus === "completed") {
        return false;
      }
      record.qualificationStatus = "completed";
      record.surveyCompletedAt = update.completedAt;
      record.qualification = update;
      return true;
    },
    async recordPreorderDecline(id, update) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) return false;
      record.preorderDecline = update;
      return true;
    },
  };
  return { repository, records };
}

function waitlistEmailInput(email) {
  return {
    email,
    placement: "homepage_hero",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    metaClickId: null,
    referrer: null,
  };
}

const CONTRIBUTOR_TEST_ENV = { CONTRIBUTOR_FEATURE_ENABLED: "true" };

async function render(
  path = "/",
  init,
  origin = "http://localhost",
  environment = {},
  requestCf,
) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const request = new Request(`${origin}${path}`, init ?? {
    headers: { accept: "text/html" },
  });
  if (requestCf) {
    Object.defineProperty(request, "cf", { value: requestCf });
  }

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...environment,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("uses explicit consent where regional tracking permission is unavailable", () => {
  assert.equal(trackingPolicyForRegion("IT", "RM"), "explicit-consent");
  assert.equal(trackingPolicyForRegion("US", "WA"), "explicit-consent");
  assert.equal(trackingPolicyForRegion("US", "NV"), "explicit-consent");
  assert.equal(trackingPolicyForRegion("US", null), "explicit-consent");
  assert.equal(trackingPolicyForRegion("US", "CA"), "us-opt-out");
});

test("gives Global Privacy Control precedence over regional and stored choices", () => {
  assert.equal(
    effectiveTrackingConsent({
      storedConsent: "granted",
      policyMode: "us-opt-out",
      globalPrivacyControl: true,
    }),
    "denied",
  );
  assert.equal(
    effectiveTrackingConsent({
      storedConsent: null,
      policyMode: "us-opt-out",
      globalPrivacyControl: false,
    }),
    "granted",
  );
  assert.equal(
    effectiveTrackingConsent({
      storedConsent: null,
      policyMode: "explicit-consent",
      globalPrivacyControl: false,
    }),
    null,
  );
});

test("retires the unavailable request.cf tracking-policy endpoint", async () => {
  const response = await render(
    "/api/privacy/tracking-policy",
    undefined,
    "https://framewearable.com",
    {},
    { country: "US", regionCode: "CA" },
  );

  assert.equal(response.status, 404);
});

test("permanently redirects www requests to the canonical host", async () => {
  const response = await render(
    "/privacy?source=www",
    undefined,
    "https://www.framewearable.com",
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://framewearable.com/privacy?source=www",
  );
  assert.equal(
    response.headers.get("strict-transport-security"),
    "max-age=31536000",
  );
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("accepts canonicalized and cached www form posts without weakening origin checks", async () => {
  const sameSiteResponse = await render(
    "/api/admin/time-zone",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://www.framewearable.com",
      },
      body: "tab=qualified&timezone=Europe%2FLondon",
    },
    "https://www.framewearable.com",
  );

  assert.equal(sameSiteResponse.status, 401);
  assert.equal(await sameSiteResponse.text(), "Authentication required.");

  const cachedRedirectResponse = await render(
    "/api/admin/time-zone",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://www.framewearable.com",
      },
      body: "tab=qualified&timezone=America%2FNew_York",
    },
    "https://framewearable.com",
  );

  assert.equal(cachedRedirectResponse.status, 401);
  assert.equal(await cachedRedirectResponse.text(), "Authentication required.");

  const opaqueRedirectResponse = await render(
    "/api/admin/time-zone",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "null",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-site",
      },
      body: "tab=qualified&timezone=America%2FNew_York",
    },
    "https://framewearable.com",
  );

  assert.equal(opaqueRedirectResponse.status, 401);
  assert.equal(await opaqueRedirectResponse.text(), "Authentication required.");

  const crossSiteResponse = await render(
    "/api/admin/time-zone",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://malicious.example",
      },
      body: "tab=qualified&timezone=Europe%2FLondon",
    },
    "https://www.framewearable.com",
  );

  assert.equal(crossSiteResponse.status, 403);
  assert.equal(await crossSiteResponse.text(), "Request origin is not allowed.");

  const opaqueCrossSiteResponse = await render(
    "/api/admin/time-zone",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "null",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
      },
      body: "tab=qualified&timezone=America%2FNew_York",
    },
    "https://framewearable.com",
  );

  assert.equal(opaqueCrossSiteResponse.status, 403);
  assert.equal(
    await opaqueCrossSiteResponse.text(),
    "Request origin is not allowed.",
  );
});

test("applies restrictive browser security headers without blocking configured integrations", async () => {
  const response = await render(
    "/",
    undefined,
    "https://framewearable.com",
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://frame-project.supabase.co",
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("strict-transport-security"),
    "max-age=31536000",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-xss-protection"), "0");
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /payment=\(\)/);

  const policy = response.headers.get("content-security-policy") ?? "";
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
  assert.match(policy, /form-action 'self'/);
  assert.match(policy, /frame-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /https:\/\/connect\.facebook\.net/);
  assert.match(policy, /https:\/\/www\.facebook\.com/);
  assert.match(policy, /https:\/\/frame-geo-attestation\.netlify\.app/);
  assert.match(policy, /https:\/\/frame-project\.supabase\.co/);
  assert.match(policy, /wss:\/\/frame-project\.supabase\.co/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(policy, /'unsafe-eval'/);
});

test("keeps local development compatible without enabling transport policy", async () => {
  const response = await render("/", undefined, "http://localhost", {
    PREORDER_MODE: "test",
  });
  const policy = response.headers.get("content-security-policy") ?? "";

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("strict-transport-security"), null);
  assert.match(policy, /'unsafe-eval'/);
  assert.match(policy, /connect-src[^;]* ws:/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test("server-renders the Frame landing page", async () => {
  const response = await render("/", undefined, "http://localhost", {
    PREORDER_MODE: "test",
    PREORDER_SHIPPING_RATE_CENTS: "0",
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Frame \| Ultrasound Wearable for Blood Pressure Patterns<\/title>/i,
  );
  assert.match(
    html,
    /See how your blood pressure responds to daily life/,
  );
  assert.doesNotMatch(html, /Currently in development/);
  assert.match(html, /hero--email-first/);
  assert.match(html, /SHIPPING EST\.\s*(?:<!-- -->)?Q1 2027/);
  assert.match(
    html,
    /The first wearable to continuously track blood pressure\s*(?:<!-- -->)?using ultrasound technology/,
  );
  assert.match(
    html,
    /Advanced technology\. Effortless to live with\./,
  );
  assert.match(
    html,
    /Personalised machine-learning analysis combines ultrasound\s*(?:<!-- -->)?signals with daily context to reveal clear patterns over time\./,
  );
  assert.doesNotMatch(
    html,
    /Frame pairs wearable ultrasound with everyday context/,
  );
  assert.doesNotMatch(html, /lower-confidence periods/);
  assert.match(
    html,
    /How intelligent signal analysis keeps your patterns clear\./,
  );
  assert.match(
    html,
    /See what is typical for you, how your body responds, and how\s*(?:<!-- -->)?long changes last\./,
  );
  assert.match(html, /Research evidence/);
  assert.match(
    html,
    /Wearable ultrasound has been evaluated in peer-reviewed human\s*(?:<!-- -->)?studies\./,
  );
  assert.match(html, />118</);
  assert.match(html, /adults studied/);
  assert.doesNotMatch(html, /Read the clinical validation study/);
  assert.match(
    html,
    /Frame is a general-wellness wearable in development\./,
  );
  assert.match(
    html,
    /It is not intended for medical decisions or to replace\s*(?:<!-- -->)?an FDA-authorized blood-pressure monitor\./,
  );
  assert.match(html, /frame-product-concept-realistic-v3-transparent-720w\.webp/);
  assert.doesNotMatch(html, /frame-hero-man-transparent-v3-720w\.webp/);
  assert.match(html, /hero-visuals--product/);
  assert.match(html, /context-content--without-product/);
  assert.match(html, /frame-woman-dumbbell-upper-arm-transparent-v1\.png/);
  assert.match(html, /Worn on the upper arm/);
  assert.match(html, /frame-sensing-concept-realistic-v3-transparent-960w\.webp/);
  assert.match(html, /frame-app-studio-v6-640w\.webp/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /Frame Wearable, Inc\./);
  assert.match(html, /class="footer-links__privacy" href="\/privacy">Privacy<\/a>/);
  assert.doesNotMatch(html, /footer-bottom__privacy/);
  assert.doesNotMatch(html, /facebook\.com\/tr\?id=/);
  assert.equal(html.match(/name="email"/g)?.length, 2);
  assert.match(html, /Reserve Frame/);
  assert.match(html, /Your price/);
  assert.match(html, /Reserve(?: for)?\s*(?:<!-- -->)?\$99/);
  assert.match(html, /\$200(?:<!-- -->)? due before shipping/);
  assert.match(html, /Launch price/);
  assert.match(html, /href="\/preorder\/review\?source=homepage_hero"/);
  assert.doesNotMatch(html, /Pre-orders are now open\./);
  assert.match(html, /See details/);
  assert.match(html, /home-preorder-hero__offer-line/);
  assert.match(html, /Reservation offer/);
  assert.match(
    html,
    /Reserve\s*(?:<!-- -->)?\$99/,
  );
  assert.doesNotMatch(html, /home-preorder-hero__saving-note/);
  assert.match(html, /home-preorder-hero__actions/);
  assert.match(html, /Join 400\+ people already waiting for Frame\./);
  assert.doesNotMatch(html, /hero-email-first__shipping-pill/);
  assert.match(html, /SHIPPING EST\.\s*(?:<!-- -->)?Q1 2027/i);
  assert.doesNotMatch(html, /home-preorder-hero__shipping/);
  assert.match(html, /home-preorder-price-comparison/);
  assert.match(html, /id="homepage-hero-preorder-waitlist-email"/);
  assert.match(html, /Get updates/);
  assert.doesNotMatch(html, /home-preorder-saving--hero/);
  assert.match(html, /\$399/);
  assert.doesNotMatch(html, /\$499/);
  assert.match(html, /Q1 2027/);
  assert.doesNotMatch(html, /What is the main reason you want Frame\?/);
  assert.doesNotMatch(html, /<dialog/i);
  assert.match(html, /<section class="final-cta" id="early-access">/);
  assert.doesNotMatch(html, /id="footer-waitlist-/);
  assert.match(html, /href="https:\/\/www\.instagram\.com\/framewearable\/"/);
  assert.match(html, /Frame on Instagram \(opens in a new tab\)/);
  assert.equal(html.match(/href="\/contact(?:\?topic=research)?"/g)?.length, 2);
  assert.doesNotMatch(html, /mailto:support@framewearable\.com/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("does not expose a dedicated interest page", async () => {
  const response = await render("/interest");
  assert.equal(response.status, 404);
});

test("redirects conventional favicon requests to the declared icon", async () => {
  const response = await render("/favicon.ico", {
    headers: { accept: "image/*" },
  });

  assert.equal(response.status, 308);
  assert.equal(
    new URL(response.headers.get("location")).pathname,
    "/favicon-transparent.png",
  );
});

test("server-renders the contact page", async () => {
  const [response, preorderResponse, previewResponse, remotePreviewResponse] = await Promise.all([
    render("/contact"),
    render("/contact?topic=preorder"),
    render("/contact?preview=success"),
    render("/contact?preview=success", undefined, "https://framewearable.com"),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Contact Frame<\/title>/i);
  assert.match(html, /Start a conversation\./);
  assert.match(html, /Choose a topic below and your message will go directly to our team\./);
  assert.match(html, /How can we help\?/);
  assert.doesNotMatch(html, /Replies by email/i);
  assert.match(html, /name="name"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="topic"/);
  assert.match(html, /value="preorder"/);
  assert.match(html, /Pre-order support/);
  assert.match(html, /name="message"/);
  assert.match(html, /support@framewearable\.com/);
  assert.match(html, /aria-label="Frame home"/);

  assert.equal(preorderResponse.status, 200);
  const preorderHtml = await preorderResponse.text();
  assert.match(preorderHtml, /contact-page contact-page--preorder/);
  assert.match(preorderHtml, /Tell us what you need help with/);
  assert.match(preorderHtml, /Include your order number or checkout email if relevant/);
  assert.match(preorderHtml, /Prefer email\?/);
  assert.match(preorderHtml, /mailto:support@framewearable\.com/);
  assert.match(preorderHtml, /<option value="preorder" selected="">/);

  assert.equal(previewResponse.status, 200);
  const previewHtml = await previewResponse.text();
  assert.match(previewHtml, /How can we help\?/);
  assert.doesNotMatch(previewHtml, /We’ve received your message\./);

  assert.equal(remotePreviewResponse.status, 200);
  const remotePreviewHtml = await remotePreviewResponse.text();
  assert.doesNotMatch(remotePreviewHtml, /We’ve received your message\./);
  assert.match(remotePreviewHtml, /How can we help\?/);
});

test("server-renders the Founding Contributor funnel locally", async () => {
  const [membershipResponse, reviewResponse, successResponse, signInResponse] =
    await Promise.all([
      render("/founding-contributors", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
      render("/founding-contributors/review", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
      render("/founding-contributors/success", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
      render("/contributors/sign-in", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
    ]);

  assert.equal(membershipResponse.status, 200);
  const membership = await membershipResponse.text();
  assert.match(membership, /Help build Frame from the beginning\./);
  assert.match(membership, /\$99 once/);
  assert.match(membership, /No automatic renewal/);
  assert.match(membership, /12 months of community access/);
  assert.match(membership, /share your perspective, and help shape what comes next/);
  assert.match(membership, /separate from the Frame device pre-order/);
  assert.doesNotMatch(membership, /founding-disclosure/);
  assert.match(membership, /A thank-you for joining us early\./);
  assert.match(membership, /10% off at launch, up to \$50/);
  assert.match(membership, /Launch benefits are subject to regional availability/);
  assert.match(membership, /Follow Frame’s development from the inside\./);
  assert.match(membership, /Monthly development updates with access to the full archive/);
  assert.match(membership, /Priority consideration for voluntary research opportunities/);
  assert.match(membership, /Now building an integrated prototype\./);
  assert.match(membership, /Initial measurement validation/);
  assert.match(membership, /Investigated whether ultrasound could capture useful arterial information\./);
  assert.match(membership, /Next planned stage/);
  assert.match(membership, /What membership revenue supports/);
  assert.match(membership, /Supporting Frame’s next stage\./);
  assert.match(membership, /Sensing, electronics, and software engineering/);
  assert.match(membership, /Operation of the contributor programme and community/);
  assert.doesNotMatch(membership, /How your contribution helps/);
  assert.match(membership, /<li class="is-completed"><span>01<\/span>/);
  assert.match(membership, /<li class="is-completed"><span>02<\/span>/);
  assert.match(membership, /<li class="is-current" aria-current="step"><span>03<\/span>/);

  assert.equal(reviewResponse.status, 200);
  const review = await reviewResponse.text();
  assert.match(review, /Frame Founding Contributor Membership/);
  assert.match(review, /Your card details won’t be requested until the next step/);
  assert.match(review, /Required acknowledgment/);
  assert.match(review, /this membership is separate from a Frame device order/i);
  assert.match(review, /any future device purchase would be a separate transaction/);
  assert.match(review, /Membership refund period/);
  assert.match(review, /14 days/);
  assert.match(review, /Continue to secure checkout · \$99/);
  assert.doesNotMatch(review, /Automatic tax is disabled during testing/);
  assert.doesNotMatch(review, /facebook\.com\/tr\?id=/);

  assert.equal(successResponse.status, 200);
  assert.match(await successResponse.text(), /activating your membership/i);
  assert.equal(signInResponse.status, 200);
  assert.match(await signInResponse.text(), /Sign in to the contributor hub/);
});

test("gates every contributor surface and link by default", async () => {
  const restrictedPaths = [
    "/founding-contributors",
    "/founding-contributors/review",
    "/founding-contributors/success",
    "/contributors",
    "/contributors/sign-in",
    "/contributors/onboarding",
    "/contributors/auth/confirm",
    "/contributors/product-status",
    "/contributors/refunds",
    "/contributors/terms",
    "/admin/contributors",
    "/api/founding-contributors/checkout",
    "/api/founding-contributors/status",
    "/api/contributors/me",
    "/api/contributors/onboarding",
    "/api/contributors/questions",
    "/api/contributors/votes",
    "/og-founding-contributors.png",
    "/contributors%2Fterms",
    "/_vinext/image?url=%2Fog-founding-contributors.png&w=1200&q=75",
  ];
  const [homeResponse, privacyResponse, ...restrictedResponses] =
    await Promise.all([
      render("/"),
      render("/privacy"),
      ...restrictedPaths.map((path) => render(path)),
    ]);

  for (const [index, response] of restrictedResponses.entries()) {
    assert.equal(response.status, 404, restrictedPaths[index]);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  }

  for (const response of [homeResponse, privacyResponse]) {
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.doesNotMatch(html, /Founding Contributor|contributor hub|membership/i);
    assert.doesNotMatch(html, /href="\/founding-contributors/);
  }
});

test("keeps every Founding Contributor surface local-only", async () => {
  const publicOrigin = "https://framewearable.com";
  const restrictedPaths = [
    "/founding-contributors",
    "/founding-contributors/review",
    "/founding-contributors/success",
    "/contributors",
    "/contributors/sign-in",
    "/contributors/onboarding",
    "/contributors/auth/confirm",
    "/contributors/product-status",
    "/contributors/refunds",
    "/contributors/terms",
    "/admin/contributors",
    "/api/founding-contributors/checkout",
    "/api/founding-contributors/status",
    "/api/contributors/me",
    "/api/contributors/onboarding",
    "/api/contributors/questions",
    "/api/contributors/votes",
    "/api/stripe/webhook",
    "/og-founding-contributors.png",
    "/contributors%2Fterms",
    "/_vinext/image?url=%2Fog-founding-contributors.png&w=1200&q=75",
  ];
  const responses = await Promise.all(
    restrictedPaths.map((path) =>
      render(path, undefined, publicOrigin, CONTRIBUTOR_TEST_ENV),
    ),
  );

  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 404, restrictedPaths[index]);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await response.text(), /not found/i);
  }

  const [homeResponse, privacyResponse, sitemapResponse] = await Promise.all([
    render("/", undefined, publicOrigin, CONTRIBUTOR_TEST_ENV),
    render("/privacy", undefined, publicOrigin, CONTRIBUTOR_TEST_ENV),
    render("/sitemap.xml", undefined, publicOrigin, CONTRIBUTOR_TEST_ENV),
  ]);
  const publicHome = await homeResponse.text();
  const publicPrivacy = await privacyResponse.text();
  const publicSitemap = await sitemapResponse.text();

  assert.equal(homeResponse.status, 200);
  assert.doesNotMatch(publicHome, /Founding Contributors/);
  assert.doesNotMatch(publicHome, /href="\/founding-contributors/);
  assert.doesNotMatch(publicPrivacy, /Founding Contributor|contributor hub|membership/i);
  assert.doesNotMatch(publicSitemap, /founding-contributors/);
});

test("renders draft contributor policies and keeps member routes private", async () => {
  const [terms, refunds, productStatus, hub, onboarding] = await Promise.all([
    render("/contributors/terms", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
    render("/contributors/refunds", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
    render("/contributors/product-status", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
    render("/contributors", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
    render("/contributors/onboarding", undefined, "http://localhost", CONTRIBUTOR_TEST_ENV),
  ]);

  assert.match(await terms.text(), /Draft for testing\. Not approved for live sales\./);
  assert.match(await refunds.text(), /Full refund within 14 days/);
  assert.match(await productStatus.text(), /now building an integrated wearable prototype/);
  assert.match(await hub.text(), /Loading your contributor hub/);
  assert.equal(onboarding.status, 307);
  assert.equal(
    onboarding.headers.get("location"),
    "http://localhost/contributors?section=profile",
  );
});

test("formats submitted names for the confirmation message", () => {
  assert.equal(formatName("sUVAN goEL"), "Suvan Goel");
  assert.equal(formatName("  mARY-jANE  o'NEILL "), "Mary-Jane O'Neill");
});

test("uses one canonical Possibly response while accepting legacy Maybe values", () => {
  assert.deepEqual(RESEARCH_CALL_OPTIONS, [
    ["yes", "Yes"],
    ["possibly", "Possibly"],
    ["no", "No"],
  ]);
  assert.equal(normalizeResearchCallValue("possibly"), "possibly");
  assert.equal(normalizeResearchCallValue("maybe"), "possibly");
});

test("keeps Possibly aligned across waitlist writers and database storage", async () => {
  const [legacySubmission, storageMigration] = await Promise.all([
    readFile(
      new URL("../lib/legacy-waitlist-submission.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260808203000_align_waitlist_research_call_value.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(
    legacySubmission,
    /open_to_research_call:\s*interviewWillingness/,
  );
  assert.doesNotMatch(legacySubmission, /interviewWillingness === "possibly"/);
  assert.match(
    storageMigration,
    /set open_to_research_call = 'possibly'[\s\S]*where open_to_research_call = 'maybe'/,
  );
  assert.match(
    storageMigration,
    /open_to_research_call in \('yes', 'possibly', 'no'\)/,
  );
});

test("adds only coarse nullable geo-attestation diagnostics", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260811150000_add_meta_geo_attestation_diagnostics.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const column of [
    "meta_geo_source",
    "meta_geo_country",
    "meta_geo_region_code",
    "meta_geo_resolution_reason",
    "meta_geo_policy_version",
    "meta_geo_retry_attempted",
    "meta_geo_retry_succeeded",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
  assert.doesNotMatch(
    migration,
    /add column[^;]*(ip|city|postal|postcode|latitude|longitude|token|header)/i,
  );
  assert.doesNotMatch(migration, /update public\.waitlist_signups/i);
});

test("uses generated raster visuals and keeps the page editable", async () => {
  const [
    page,
    layout,
    css,
    api,
    supabase,
    privacy,
    demographicsMigration,
    waitlistFlow,
    qualificationPage,
    waitlistOptions,
    metaPixel,
    metaTracking,
    contributorMigration,
    contributorCheckout,
    contributorAccess,
    contributorPayments,
    publicFiles,
  ] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/waitlist/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/supabase-admin.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260802000000_add_waitlist_demographics.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/components/waitlist-signup-flow.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/early-access/questions/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/waitlist-options.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/meta-pixel.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/meta-tracking.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260803000000_add_founding_contributors.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/api/founding-contributors/checkout/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/contributor-access.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/contributor-payments.server.ts", import.meta.url), "utf8"),
    readdir(new URL("../public/", import.meta.url)),
  ]);

  assert.match(page, /src="\/frame-product-concept-realistic-v3-transparent-720w\.webp"/);
  assert.match(page, /width=\{1254\}\s+height=\{1254\}/);
  assert.match(
    css,
    /\.product-concept-showcase__media img\s*\{[\s\S]*?width: min\(24vw, 270px\);/,
  );
  assert.match(page, /className="hero-lifestyle hero-lifestyle--product"/);
  assert.match(
    page,
    /src="\/frame-product-concept-realistic-v3-transparent-720w\.webp"[\s\S]*?width=\{1254\}[\s\S]*?height=\{1254\}/,
  );
  assert.match(css, /\.hero-visuals\s*\{[\s\S]*?top: 12px;/);
  assert.doesNotMatch(css, /\.hero-lifestyle\s*\{[^}]*transform:/);
  assert.match(
    css,
    /\.hero-lifestyle img\s*\{[^}]*height: 98\.398125%;[^}]*transform: translate\(-144px, 76px\);/,
  );
  assert.match(
    css,
    /\.hero--email-first \.hero-email-first__eyebrow\s*\{[^}]*order: 1;/,
  );
  assert.match(css, /\.hero--email-first h1\s*\{[^}]*order: 2;/);
  assert.match(css, /\.hero--email-first \.hero-intro\s*\{[^}]*order: 3;/);
  assert.match(
    css,
    /\.hero--email-first \.waitlist-signup--compact\s*\{[^}]*order: 4;/,
  );
  assert.match(page, /src="\/frame-sensing-concept-realistic-v3-transparent-960w\.webp"/);
  assert.match(page, /src="\/frame-app-studio-v6-640w\.webp"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(waitlistFlow, /fetch\("\/api\/waitlist"/);
  assert.match(waitlistFlow, /MAX_QUALITATIVE_DETAIL_LENGTH = 300/);
  assert.match(waitlistFlow, /How many days in the past 30 did you measure/);
  assert.match(
    waitlistFlow,
    /What prompted your most recent blood pressure measurement outside a medical appointment\?/,
  );
  assert.match(
    waitlistOptions,
    /It was part of my regular or clinician-recommended monitoring/,
  );
  assert.match(
    waitlistOptions,
    /I wanted to understand how it changed or what affected it/,
  );
  assert.doesNotMatch(waitlistOptions, /A clinician asked me to/);
  assert.doesNotMatch(waitlistOptions, /Seeing how it changed during the day or overnight/);
  assert.match(
    waitlistFlow,
    /What did you use for that blood pressure measurement\?/,
  );
  assert.match(waitlistOptions, /\["automated_upper_arm", "An upper-arm cuff"\]/);
  assert.match(waitlistOptions, /A clinician-provided monitor/);
  assert.match(waitlistOptions, /Something else or I don’t remember/);
  assert.match(
    waitlistOptions,
    /LEGACY_MONITORING_METHOD_OPTIONS = \[[\s\S]*?\["do_not_remember", "I don’t remember"\]/,
  );
  assert.match(
    waitlistFlow,
    /How well did that blood pressure measurement meet your needs\?/,
  );
  assert.match(
    waitlistFlow,
    /Before today, had you taken any steps to measure your blood pressure outside appointments\?/,
  );
  assert.match(waitlistOptions, /I had a device but hadn’t used it/);
  assert.match(
    waitlistOptions,
    /I had researched devices or asked a clinician what to use/,
  );
  assert.match(waitlistOptions, /I hadn’t considered it before/);
  assert.match(
    waitlistOptions,
    /LEGACY_MONITORING_READINESS_OPTIONS = \[[\s\S]*?"asked_clinician"/,
  );
  assert.match(waitlistOptions, /It gave me what I needed easily/);
  assert.match(waitlistOptions, /It left important questions unanswered/);
  assert.match(
    waitlistOptions,
    /I was only taking a reading, not trying to understand anything else/,
  );
  assert.match(
    waitlistOptions,
    /LEGACY_MONITORING_OUTCOME_OPTIONS = \[[\s\S]*?"difficult_and_unanswered"/,
  );
  assert.match(waitlistFlow, /Thinking about that specific occasion, what was difficult or/);
  assert.match(waitlistFlow, /type="radio"/);
  assert.match(waitlistFlow, /name="qualitativeDetail"/);
  assert.doesNotMatch(waitlistFlow, /name="firstName"/);
  assert.doesNotMatch(waitlistFlow, /name="lastName"/);
  assert.doesNotMatch(waitlistFlow, /name="age"/);
  assert.doesNotMatch(waitlistFlow, /name="gender"/);
  assert.match(waitlistFlow, /name="email"/);
  assert.match(page, /WaitlistSignupProvider/);
  assert.match(page, /<WaitlistSignupFlow\s+placement="homepage_hero"\s+compact/);
  assert.match(page, /<WaitlistSignupFlow\s+placement="homepage_final"\s+tone="light"/);
  assert.match(waitlistFlow, /router\.push\("\/early-access\/questions"\)/);
  assert.match(qualificationPage, /WaitlistQualificationFlow/);
  assert.match(qualificationPage, /WaitlistSurveyHeaderAction/);
  assert.match(qualificationPage, /previewSurvey=\{previewSurvey\}/);
  assert.match(waitlistOptions, /See my blood pressure patterns over time/);
  assert.match(waitlistOptions, /Understand my blood pressure while sleeping/);
  assert.match(waitlistFlow, /Thanks\. Your answers have been saved\./);
  assert.match(waitlistFlow, /Response saved/);
  assert.match(waitlistFlow, /Thank you for sharing\./);
  assert.match(
    waitlistFlow,
    /Your feedback will help us shape Frame\.[\s\S]*?interest-flow__decline-trigger[\s\S]*?Return to Frame[\s\S]*?→/,
  );
  assert.doesNotMatch(waitlistFlow, /If you decide to continue/);
  assert.doesNotMatch(waitlistFlow, /Thanks—that helps\./);
  assert.match(
    waitlistFlow,
    /interest-flow__decline-trigger[\s\S]*?I’m not ready to reserve[\s\S]*?→/,
  );
  assert.match(
    css,
    /\.interest-flow__decline-trigger\s*\{[^}]*border: 1px solid rgba\(32, 33, 30, 0\.22\);/,
  );
  assert.match(
    css,
    /\.preorder-review-copy__desktop\s*\{\s*display: none;/,
  );
  assert.match(
    css,
    /\.preorder-checkout-action__promise\s*\{[^}]*color: #355a3d;/,
  );
  assert.match(
    css,
    /\.checkout-page\.preorder-checkout-page\s*\{[^}]*min-height: calc\(100dvh \+ 64px\);/,
  );
  assert.doesNotMatch(waitlistFlow, /Thanks—your answers have been saved\./);
  assert.doesNotMatch(waitlistFlow, /interest-flow__success--preorder/);
  assert.doesNotMatch(waitlistFlow, /interest-flow__success-product/);
  assert.match(waitlistFlow, /You’re subscribed\./);
  assert.doesNotMatch(waitlistFlow, /formatName\(flow\.firstName\)|Thanks, \{/);
  assert.match(api, /monitoringFrequencyValues/);
  assert.match(api, /monitoringMethodValues/);
  assert.match(api, /monitoringOutcomeValues/);
  assert.match(api, /monitoringReadinessValues/);
  assert.match(waitlistFlow, /window\.sessionStorage/);
  assert.match(waitlistFlow, /trackMetaLead\(metaEventId\)/);
  assert.doesNotMatch(waitlistFlow, /className="interest-flow__back" href=\{finishHref\}>Back<\/Link>/);
  assert.match(
    waitlistFlow,
    /flow\.surveyStep > 0 \? \([\s\S]*?className="button button--secondary interest-flow__back"[\s\S]*?Back[\s\S]*?\) : null/,
  );
  assert.match(css, /\.interest-flow__actions--split > \.interest-flow__back\s*\{[^}]*flex: 0 1 140px;/);
  assert.match(css, /\.interest-flow__actions--split > \.button\s*\{[^}]*width: auto;/);
  assert.match(css, /\.interest-flow__actions--split > \.button:not\(\.interest-flow__back\)\s*\{[^}]*flex: 0 0 auto;[^}]*min-width: 146px;[^}]*white-space: nowrap;/);
  assert.match(css, /\.interest-flow__actions--split\s*\{[^}]*gap: 12px;/);
  assert.match(css, /\.interest-flow__actions--split \.button\s*\{[^}]*min-width: 0;/);
  assert.match(css, /\.interest-flow__actions \.interest-flow__back\s*\{[^}]*border: 1px solid var\(--ink\);[^}]*background: transparent;/);
  assert.match(waitlistFlow, /MEASURED_SURVEY_STEPS = 4/);
  assert.match(waitlistFlow, /NEVER_MEASURED_SURVEY_STEPS = 2/);
  assert.match(waitlistFlow, /name="monitoring-frequency"/);
  assert.match(waitlistFlow, /name="monitoring-reason"/);
  assert.match(waitlistFlow, /name="monitoring-readiness"/);
  assert.match(waitlistFlow, /name="monitoring-method"/);
  assert.match(waitlistFlow, /name="monitoring-outcome"/);
  assert.match(waitlistFlow, /name="preorder-decline-reason"/);
  assert.match(
    waitlistFlow,
    /What’s the main reason you wouldn’t reserve Frame today\?/,
  );
  assert.match(waitlistOptions, /I need to see more evidence that it works accurately/);
  assert.match(waitlistOptions, /I don’t want to pay for a product this far before it ships/);
  assert.match(waitlistOptions, /I’d need to see a real working\/final product first/);
  assert.match(waitlistFlow, /reliable automatic blood-pressure tracking throughout the day/);
  assert.match(waitlistFlow, /What would make you comfortable buying Frame\?/);
  assert.match(waitlistFlow, /short call or testing an early Frame prototype/);
  assert.match(waitlistFlow, /name="willingness-to-pay"/);
  assert.match(waitlistFlow, /name="evidence-requirements"/);
  assert.match(waitlistFlow, /name="research-call"/);
  assert.match(
    waitlistOptions,
    /LEGACY_PREORDER_DECLINE_REASON_OPTIONS = \[[\s\S]*?"need_more_product_detail"[\s\S]*?"need_to_discuss"/,
  );
  assert.match(waitlistFlow, /action: "record_preorder_decline"/);
  assert.match(api, /preorderDeclineReasonValues/);
  assert.match(api, /preorder_decline_reason: update\.reason/);
  assert.match(api, /preorder_decline_detail: update\.detail/);
  assert.match(waitlistFlow, /aria-label="Skip survey"/);
  assert.match(waitlistFlow, /flow\.stage === "preorder_decline"/);
  assert.match(waitlistFlow, /aria-label="Skip question and return to Frame"/);
  assert.match(waitlistFlow, /site-header__back--forward/);
  assert.doesNotMatch(waitlistFlow, />\s*Skip questions\s*</);
  assert.doesNotMatch(waitlistFlow, /Skip and return to Frame/);
  assert.match(css, /padding: 28px 0 34px;/);
  assert.match(waitlistFlow, /LOCAL_PREVIEW_SIGNUP_TOKEN = "local-survey-preview"/);
  assert.doesNotMatch(waitlistFlow, /requiredProfileErrors/);
  assert.match(waitlistFlow, /disabled=\{flow\.surveyStatus === "submitting"\}/);
  assert.match(
    css,
    /\.interest-flow__actions > \.button:only-child\s*\{[^}]*margin-left: auto;/,
  );
  assert.match(
    metaPixel,
    /"trackSingle",\s*META_PIXEL_ID,\s*"Lead"/,
  );
  assert.match(metaPixel, /eventID: lead\.eventId/);
  assert.match(metaPixel, /frame-meta-pending-leads-v1/);
  assert.match(metaPixel, /metaLeadDeliveriesInFlight\.has\(lead\.eventId\)/);
  assert.match(metaPixel, /if \(!metaLeadWasRecorded\(lead\.eventId\)\)/);
  assert.match(
    metaPixel,
    /markMetaLeadRecorded\(lead\.eventId\);[\s\S]*notifyMetaLeadDelivery\(lead\.eventId, geoPolicy\)/,
  );
  assert.match(
    metaPixel,
    /requestTrackingPolicyAttestation\(\);[\s\S]*currentConsent !== "granted"[\s\S]*"Lead"/,
  );
  assert.match(metaPixel, /action: "deliver_meta_lead"/);
  assert.match(waitlistFlow, /tracking: getMetaTrackingContext\(\)/);
  assert.match(metaPixel, /frame-meta-lead-recorded-v1/);
  assert.match(metaPixel, /frame-optional-tracking-consent-v1/);
  assert.match(metaPixel, /effectiveConsent !== "granted"/);
  assert.match(metaPixel, />\s*Turn off\s*</);
  assert.match(metaPixel, />\s*Allow\s*</);
  assert.match(metaPixel, /Privacy choices/);
  assert.match(metaPixel, /preferencesOpen \|\| \(pixelAllowedOnRoute && requiresInitialChoice\)/);
  assert.match(metaPixel, /preferencesRef\.current\?\.focus\(\)/);
  assert.match(metaPixel, /ref=\{preferencesRef\}[\s\S]*?tabIndex=\{-1\}/);
  assert.match(metaPixel, /navigator\.globalPrivacyControl === true/);
  assert.match(metaPixel, /readServerGlobalPrivacyControl/);
  assert.match(metaPixel, /requestTrackingPolicyAttestation/);
  assert.match(metaPixel, /GEO_POLICY_UPDATED_EVENT/);
  assert.match(waitlistFlow, /geoAttestationToken: geoPolicy\.token/);
  assert.match(metaPixel, /geoAttestationToken: geoPolicy\.token/);
  assert.doesNotMatch(metaPixel, /style=\{\{[^}]*position: "fixed"/);
  assert.match(
    css,
    /\.tracking-consent-trigger\s*\{[^}]*position: fixed;/,
  );
  assert.match(
    css,
    /\.privacy-page ~ \.tracking-consent-trigger\s*\{[^}]*position: fixed !important;[^}]*width: 42px;[^}]*height: 42px;/,
  );
  assert.match(
    css,
    /\.interest-flow ~ \.tracking-consent-trigger\s*\{[^}]*position: relative !important;[^}]*width: 42px;[^}]*height: 42px;/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.tracking-consent\s*\{[^}]*max-height: calc\(100dvh - 24px\);[^}]*overflow-y: auto;/,
  );
  assert.match(
    css,
    /\.tracking-consent--redesigned\s*\{[^}]*max-height: calc\(100dvh - 32px\);/,
  );
  assert.match(layout, /useRedesignedConsent=\{preorderSalesEnabled\}/);
  assert.match(metaPixel, /tracking-consent--redesigned/);
  assert.doesNotMatch(metaPixel, /setTimeout\(loadPixel/);
  assert.match(metaPixel, /META_PIXEL_ID/);
  assert.match(metaTracking, /1068997465474786/);
  assert.match(metaPixel, /PRIVATE_PREFIXES = \["\/contributors", "\/admin", "\/api"\]/);
  assert.match(metaPixel, /"\/founding-contributors\/review"/);
  assert.match(metaPixel, /"\/founding-contributors\/success"/);
  assert.match(metaPixel, /NO_PIXEL_EXACT_PATHS = \["\/contact", "\/privacy", "\/unsubscribe"\]/);
  assert.match(contributorMigration, /create table if not exists public\.contributors/);
  assert.match(contributorMigration, /contributor_number bigint generated by default as identity unique/);
  assert.match(contributorMigration, /checkout_intent_id uuid unique/);
  assert.doesNotMatch(contributorMigration, /contributor_number[^\n]*check[^\n]*100/i);
  assert.match(contributorCheckout, /automatic_tax: \{ enabled: false \}/);
  assert.match(contributorCheckout, /consent_collection: \{ terms_of_service: "required" \}/);
  assert.match(contributorCheckout, /mode: "payment"/);
  assert.match(contributorAccess, /supabase\.auth\.getUser\(accessToken\)/);
  assert.match(contributorAccess, /membership_status !== "active"/);
  assert.match(contributorPayments, /reason: "duplicate"/);
  assert.match(contributorPayments, /founding-contributor-duplicate-\$\{input\.sessionId\}/);
  assert.match(contributorPayments, /if \(duplicatePayment\) return/);
  assert.match(contributorPayments, /existingContributor\.checkout_intent_id === intent\.id/);
  assert.doesNotMatch(page, /Connect a real waitlist API/);
  assert.match(layout, /url: "\/og-launch-v2\.png"/);
  assert.match(
    layout,
    /\{children\}[\s\S]*?<MetaPixelRouteGuard useRedesignedConsent=\{preorderSalesEnabled\} \/>/,
  );
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(api, /from\("waitlist_signups"\)/);
  assert.match(api, /qualification_status: "completed"/);
  assert.match(api, /monitoring_frequency: update\.monitoringFrequency/);
  assert.match(api, /monitoring_reason: update\.monitoringReason/);
  assert.match(api, /monitoring_readiness: update\.monitoringReadiness/);
  assert.match(api, /current_monitoring_method: update\.monitoringMethod/);
  assert.match(api, /monitoring_outcome: update\.monitoringOutcome/);
  assert.match(api, /frustration_or_missing_need: update\.qualitativeDetail/);
  assert.match(supabase, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(page, /SUPABASE_SECRET_KEY|createClient/);
  assert.match(demographicsMigration, /add column if not exists gender text/);
  assert.match(demographicsMigration, /add column if not exists age smallint/);
  assert.match(privacy, /We do not sell your information for money\./);
  assert.match(privacy, /We use the Meta Pixel/);
  assert.match(privacy, /Global Privacy Control/);
  assert.match(privacy, /For other\s+US visitors, it may start automatically/);
  assert.deepEqual(
    [
      "frame-app-studio.png",
      "frame-app-studio-v5.png",
      "frame-app-studio-v5.webp",
      "frame-hero-man-transparent-v3.png",
      "frame-hero-man-transparent-v3.webp",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-product-concept-realistic-v3-transparent.webp",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v3-transparent.webp",
      "og-launch-v2.png",
    ].filter(
      (file) => publicFiles.includes(file),
    ),
    [
      "frame-app-studio.png",
      "frame-app-studio-v5.png",
      "frame-app-studio-v5.webp",
      "frame-hero-man-transparent-v3.png",
      "frame-hero-man-transparent-v3.webp",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-product-concept-realistic-v3-transparent.webp",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v3-transparent.webp",
      "og-launch-v2.png",
    ],
  );
});

test("rejects incomplete interest responses before storage", async () => {
  const response = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com" }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /main reason/i);
});

test("requires explicit membership acknowledgment before checkout", async () => {
  const response = await render("/api/founding-contributors/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ acknowledged: false }),
  }, "http://localhost", CONTRIBUTOR_TEST_ENV);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /not ordering or reserving a Frame device/i);
});

test("uses recorded payment data in contributor and owner views", async () => {
  const [access, status, success, admin, checkout, membershipPage, reviewPage] =
    await Promise.all([
      readFile(new URL("../lib/contributor-access.server.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/founding-contributors/status/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/components/contributor-success.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/contributors/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/founding-contributors/checkout/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/founding-contributors/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/founding-contributors/review/page.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(access, /from\("contributor_payments"\)/);
  assert.match(access, /amountPaidCents: payment\.amount_total/);
  assert.match(access, /currency: payment\.currency/);
  assert.match(status, /amountPaidCents: paymentResult\.data\.amount_total/);
  assert.match(status, /currency: paymentResult\.data\.currency/);
  assert.match(success, /formatMoney\(membership\.amountPaidCents, membership\.currency\)/);
  assert.match(admin, /from\("contributor_payments"\)/);
  assert.doesNotMatch(admin, /amount_paid_cents/);
  assert.match(checkout, /isFoundingContributorSalesRequestEnabled\(request\)/);
  assert.match(membershipPage, /isFoundingContributorSalesPageEnabled\(\)/);
  assert.match(reviewPage, /isFoundingContributorSalesPageEnabled\(\)/);
});

test("rejects unverified Stripe webhooks", async () => {
  const response = await render("/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Stripe signature is required/i);
});

test("requires valid demographic information before storage", async () => {
  const baseApplication = {
    mainReason: "understand_sleep",
    recentSituation:
      "After a restless night, my cuff reading was unusually high and I wanted more context.",
    monitoringMethod: "upper_arm_occasionally",
    interviewWillingness: "possibly",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  };

  const missingGender = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...baseApplication, age: 36 }),
  });
  assert.equal(missingGender.status, 400);
  assert.match(await missingGender.text(), /gender/i);

  const invalidAge = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...baseApplication,
      gender: "prefer_not_to_say",
      age: 17,
    }),
  });
  assert.equal(invalidAge.status, 400);
  assert.match(await invalidAge.text(), /age between 18 and 120/i);
});

test("rejects an invalid email before creating a waitlist record", async () => {
  const response = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "capture_email",
      email: "not-an-email",
      placement: "homepage_hero",
    }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /valid email address/i);
});

test("requires the behavioural survey fields while keeping written detail optional", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("required-profile-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const fetchFromWorker = (init) => worker.fetch(
    new Request("http://localhost/api/waitlist", init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  const email = `required-profile-${Date.now()}@example.com`;
  const captureResponse = await fetchFromWorker({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "capture_email",
      email,
      placement: "qualification_page",
    }),
  });
  assert.equal(captureResponse.status, 201);
  const capture = await captureResponse.json();

  const incompleteResponse = await fetchFromWorker({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit_qualification",
      signupToken: capture.signupToken,
      monitoringFrequency: "three_to_seven_days",
    }),
  });

  assert.equal(incompleteResponse.status, 400);
  assert.match(await incompleteResponse.text(), /main reason/i);

  const completeResponse = await fetchFromWorker({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit_qualification",
      signupToken: capture.signupToken,
      monitoringFrequency: "three_to_seven_days",
      monitoringReason: "daily_factor_effect",
      monitoringMethod: "automated_upper_arm",
      monitoringOutcome: "worked_with_difficulty",
    }),
  });

  assert.equal(completeResponse.status, 200);
  assert.match(await completeResponse.text(), /"status":"completed"/);

  const invalidDeclineResponse = await fetchFromWorker({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "record_preorder_decline",
      signupToken: capture.signupToken,
      reason: "not_a_real_reason",
    }),
  });
  assert.equal(invalidDeclineResponse.status, 400);

  const declineResponse = await fetchFromWorker({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "record_preorder_decline",
      signupToken: capture.signupToken,
      reason: "need_more_evidence",
      evidenceRequirements: ["validated_cuff_comparison", "working_prototype"],
      openToResearchCall: "possibly",
    }),
  });
  assert.equal(declineResponse.status, 200);
  assert.match(await declineResponse.text(), /"status":"recorded"/);
});

test("returns one stable Lead ID and rejects unsigned request.cf or header policy", async () => {
  const tracking = {
    version: 1,
    storedConsent: null,
    globalPrivacyControl: false,
    pixelReady: false,
    eventSourceUrl: "http://localhost/?fbclid=must-not-reach-meta-url",
    fbp: null,
    fbc: null,
  };
  const cf = { country: "US", regionCode: "CA" };
  const environment = { META_CONVERSIONS_API_ACCESS_TOKEN: "" };
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("meta-policy-test", `${process.pid}-${Date.now()}`);
  const { default: testWorker } = await import(workerUrl.href);
  const postWaitlist = (body, extraHeaders = {}) => {
    const request = new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    });
    Object.defineProperty(request, "cf", { value: cf });
    return testWorker.fetch(
      request,
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        ...environment,
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
  };

  const capture = await postWaitlist({
    action: "capture_email",
    email: "codex-meta-policy-test-20260810@example.com",
    placement: "tracking_test",
    metaClickId: "codex-test-click-id",
    tracking,
  });
  const captured = await capture.json();

  assert.equal(capture.status, 201);
  assert.equal(captured.leadCreated, true);
  assert.match(captured.metaEventId, /^[0-9a-f-]{36}$/i);

  const unsignedReplay = await postWaitlist(
    {
      action: "deliver_meta_lead",
      metaEventId: captured.metaEventId,
      browserLeadAttempted: true,
      tracking,
    },
    { "x-frame-tracking-policy": "us-opt-out" },
  );
  const unsignedResult = await unsignedReplay.json();
  assert.equal(unsignedResult.permitted, false);
  assert.equal(unsignedResult.capiStatus, "skipped_not_permitted");

  const gpcReplay = await postWaitlist(
    {
      action: "deliver_meta_lead",
      metaEventId: captured.metaEventId,
      browserLeadAttempted: false,
      tracking,
    },
    { "sec-gpc": "1" },
  );
  const gpcResult = await gpcReplay.json();
  assert.equal(gpcResult.permitted, false);
  assert.equal(gpcResult.capiStatus, "skipped_not_permitted");
});

test("validates contact messages before sending email", async () => {
  const response = await render("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "A" }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /enter your name/i);

  const [contactForm, contactApi, privacy, sitemap] = await Promise.all([
    readFile(new URL("../app/components/contact-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  ]);

  assert.match(contactForm, /fetch\("\/api\/contact"/);
  assert.match(contactApi, /const topicConfig = getContactTopic\(topic\)/);
  assert.match(contactApi, /to: \[topicConfig\.recipient\]/);
  assert.match(contactApi, /https:\/\/api\.resend\.com\/emails/);
  assert.match(contactApi, /reply_to: email/);
  assert.doesNotMatch(contactForm, /MIN_MESSAGE_LENGTH|minLength=/);
  assert.doesNotMatch(contactApi, /MIN_MESSAGE_LENGTH/);
  assert.match(contactForm, /Enter a message\./);
  assert.match(contactApi, /Enter a message\./);
  assert.match(privacy, /href="\/contact\?topic=privacy"/);
  assert.doesNotMatch(privacy, /mailto:support@framewearable\.com/);
  assert.match(sitemap, /import \{ SITE_URL \} from "@\/lib\/site"/);
  assert.match(sitemap, /`\$\{SITE_URL\}\/contact`/);
});

test("moves an email-only lead to qualified after that same signup completes the survey", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const captured = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("person@example.com"),
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].qualificationStatus, "not_started");

  const completed = await completeWaitlistQualification(
    repository,
    captured.signupToken,
    {
      primaryInterest: "understand_daily_factors",
      primaryInterestOther: null,
      monitoringMethod: "upper_arm_occasionally",
      monitoringMethodOther: null,
      frustration: "Occasional readings lack everyday context.",
      researchCall: "yes",
      firstName: "Ada",
      lastName: "Lovelace",
      age: 36,
      gender: "woman",
      completedAt: "2026-08-06T12:05:00.000Z",
    },
  );

  assert.equal(completed.status, "completed");
  assert.equal(records.length, 1);
  assert.equal(records[0].email, "person@example.com");
  assert.equal(records[0].qualificationStatus, "completed");
});

test("captures email before the survey and treats a duplicate as success", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const input = waitlistEmailInput("duplicate@example.com");

  const captured = await captureWaitlistEmail(repository, input);
  const duplicate = await captureWaitlistEmail(repository, input);

  assert.equal(captured.status, "joined");
  assert.equal(captured.leadCreated, true);
  assert.equal(duplicate.status, "already_registered");
  assert.equal(duplicate.leadCreated, false);
  assert.equal(duplicate.signupToken, captured.signupToken);
  assert.equal(records.length, 1);
  assert.equal(records[0].qualificationStatus, "not_started");
});

test("records a completed respondent's main pre-order objection", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const captured = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("objection@example.com"),
  );

  await completeWaitlistQualification(repository, captured.signupToken, {
    monitoringFrequency: "three_to_seven_days",
    monitoringReason: "daily_factor_effect",
    monitoringReadiness: null,
    monitoringMethod: "automated_upper_arm",
    monitoringOutcome: "worked_with_difficulty",
    qualitativeDetail: null,
    completedAt: "2026-08-13T17:00:00.000Z",
  });

  const recorded = await recordWaitlistPreorderDecline(
    repository,
    captured.signupToken,
    {
      reason: "need_more_evidence",
      detail: null,
      recordedAt: "2026-08-13T17:01:00.000Z",
    },
  );

  assert.equal(recorded.status, "recorded");
  assert.equal(records[0].preorderDecline.reason, "need_more_evidence");
});

test("does not accept a pre-order objection before survey completion", async () => {
  const { repository } = createWaitlistRepositoryFixture();
  const captured = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("premature-objection@example.com"),
  );

  const recorded = await recordWaitlistPreorderDecline(
    repository,
    captured.signupToken,
    {
      reason: "price_too_high",
      detail: null,
      recordedAt: "2026-08-13T17:01:00.000Z",
    },
  );

  assert.equal(recorded.status, "qualification_required");
});

test("writes legacy full-survey submissions into the canonical qualification fields", async () => {
  const legacySubmission = await readFile(
    new URL("../lib/legacy-waitlist-submission.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(legacySubmission, /qualification_status: "completed"/);
  assert.match(legacySubmission, /primary_interest: mainReason/);
  assert.match(legacySubmission, /current_monitoring_method: monitoringMethod/);
  assert.match(legacySubmission, /survey_completed_at: completedAt/);
});

test("keeps an email-only lead unqualified when the survey is skipped", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const captured = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("skip@example.com"),
  );

  const skipped = await skipWaitlistQualification(
    repository,
    captured.signupToken,
    "2026-08-06T12:00:00.000Z",
  );

  assert.equal(skipped.status, "skipped");
  assert.equal(records.length, 1);
  assert.equal(records[0].email, "skip@example.com");
  assert.equal(records[0].qualificationStatus, "skipped");
});

test("surfaces waitlist storage failures without reporting success", async () => {
  const { repository } = createWaitlistRepositoryFixture();
  repository.findByEmail = async () => {
    throw new Error("database unavailable");
  };

  await assert.rejects(
    captureWaitlistEmail(repository, waitlistEmailInput("error@example.com")),
    /database unavailable/,
  );
});

test("accepts a persisted admin time zone and rejects invalid values", () => {
  assert.equal(resolveAdminTimeZone("Europe/Rome"), "Europe/Rome");
  assert.equal(resolveAdminTimeZone("America/New_York"), "America/New_York");
  assert.equal(resolveAdminTimeZone("invalid"), "UTC");
});

test("retries only the transient Supabase JWT issued-at-future failure", async () => {
  const jwtClockSkewError = {
    code: "PGRST303",
    message: "JWT issued at future",
  };
  let attempts = 0;

  const recovered = await retrySupabaseReadOnJwtIssuedAtFuture(
    async () => {
      attempts += 1;
      return attempts === 1
        ? { data: null, error: jwtClockSkewError }
        : { data: ["recovered"], error: null };
    },
    { retryDelaysMs: [0, 0] },
  );

  assert.equal(attempts, 2);
  assert.deepEqual(recovered.data, ["recovered"]);
  assert.equal(recovered.error, null);
  assert.equal(isSupabaseJwtIssuedAtFutureError(jwtClockSkewError), true);
  assert.equal(
    isSupabaseJwtIssuedAtFutureError({
      code: "PGRST303",
      message: "Another JWT validation failure",
    }),
    false,
  );
});

test("does not retry unrelated Supabase failures", async () => {
  let attempts = 0;
  const originalFailure = {
    data: null,
    error: { code: "42P01", message: "relation does not exist" },
  };

  const result = await retrySupabaseReadOnJwtIssuedAtFuture(
    async () => {
      attempts += 1;
      return originalFailure;
    },
    { retryDelaysMs: [0, 0] },
  );

  assert.equal(attempts, 1);
  assert.equal(result, originalFailure);
});

test("separates, visualizes, exports, and permanently deletes admin leads", async () => {
  const [adminPage, timeZoneForm, timeZoneHelpers, adminSettings, supabaseRetry, timeZoneRoute, timeZoneMigration, insights, leadHelpers, csvRoute, workbookRoute, deleteRoute, css] = await Promise.all([
    readFile(new URL("../app/admin/waitlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/admin-time-zone-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-time-zone.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-settings.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase-retry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/time-zone/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808140000_persist_admin_time_zone.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/waitlist/qualified-lead-insights.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/waitlist-leads.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist.csv/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist.xlsx/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(leadHelpers, /type LeadTab = "qualified" \| "unqualified"/);
  assert.match(leadHelpers, /type SurveyFlow = "new" \| "legacy"/);
  assert.match(leadHelpers, /qualification\.monitoringFrequency[\s\S]*\? "new"[\s\S]*: "legacy"/);
  assert.match(adminPage, /New survey responses/);
  assert.match(adminPage, /Previous survey responses/);
  assert.match(adminPage, /Unqualified leads/);
  assert.match(adminPage, /entry\.surveyFlow === "new"/);
  assert.match(adminPage, /entry\.surveyFlow === "legacy"/);
  assert.match(adminPage, /activeTab === "unqualified"/);
  assert.match(adminPage, /<th>Email<\/th>/);
  assert.match(adminPage, /<th>Source<\/th>/);
  assert.match(adminPage, /<th>Date and time<\/th>/);
  assert.match(adminPage, /<th>Delete<\/th>/);
  assert.match(adminPage, /leadLabel=\{signup\.email\}/);
  assert.match(adminPage, /New survey insights/);
  assert.match(adminPage, /waitlistTabHref\("insights"\)/);
  assert.match(adminPage, /Outcome and follow-up/);
  assert.match(adminPage, /admin-table--new-survey/);
  assert.match(adminPage, /admin-survey-answer__label">Outcome/);
  assert.match(adminPage, /admin-survey-answer__label[\s\S]*?Written insight/);
  assert.match(adminPage, /admin-survey-answer__label[\s\S]*?Reservation objection/);
  assert.match(css, /\.admin-table--new-survey\s*\{[^}]*table-layout: fixed;/);
  assert.match(css, /\.admin-survey-answer\s*\{[^}]*display: grid;/);
  assert.match(adminPage, /Export spreadsheet/);
  assert.match(adminPage, /AdminTimeZoneForm/);
  assert.match(timeZoneForm, /Lead time zone/);
  assert.match(timeZoneHelpers, /Europe\/Rome/);
  assert.match(timeZoneHelpers, /America\/New_York/);
  assert.match(adminPage, /getPersistedAdminTimeZone/);
  assert.match(timeZoneForm, /action="\/api\/admin\/time-zone\?form=v2"/);
  assert.match(timeZoneForm, /method="post"/);
  assert.match(adminSettings, /from\("admin_settings"\)/);
  assert.match(adminSettings, /setPersistedAdminTimeZone/);
  assert.match(adminPage, /retrySupabaseReadOnJwtIssuedAtFuture/);
  assert.match(adminPage, /return <WaitlistUnavailable userEmail=\{user\.email\} \/>/);
  assert.match(adminSettings, /isSupabaseJwtIssuedAtFutureError/);
  assert.match(supabaseRetry, /code === "PGRST303"/);
  assert.match(supabaseRetry, /jwt issued at future/i);
  assert.match(timeZoneRoute, /isWaitlistAdmin\(user\.email\)/);
  assert.match(timeZoneRoute, /setPersistedAdminTimeZone\(timeZone, user\.email\)/);
  assert.match(timeZoneRoute, /status: 303/);
  assert.match(timeZoneMigration, /create table if not exists public\.admin_settings/);
  assert.match(timeZoneMigration, /time_zone text not null default 'UTC'/);
  assert.doesNotMatch(timeZoneForm, /document\.cookie/);
  assert.doesNotMatch(adminPage, /searchParams.*timezone|encodeURIComponent\(timeZone\)/s);
  assert.match(adminPage, /timeZone: selectedTimeZone/);
  assert.doesNotMatch(adminPage, /Manage hidden test entries/);
  assert.match(adminPage, /DeleteWaitlistSignupButton/);
  assert.match(insights, /Behavioural survey responses/);
  assert.match(insights, /eyebrow="Question 1"/);
  assert.match(insights, /Question 2 · measured before/);
  assert.match(insights, /eyebrow="Question 4"/);
  assert.match(insights, /Post-survey objection/);
  assert.doesNotMatch(insights, /interviewLabels|genderLabels/);
  assert.match(leadHelpers, /isQualifiedSignup/);
  assert.match(leadHelpers, /qualification_status: QualificationStatus/);
  assert.match(leadHelpers, /Email captured · survey not completed/);
  assert.match(leadHelpers, /survey_completed_at/);
  assert.match(leadHelpers, /MONITORING_FREQUENCY_OPTIONS/);
  assert.match(leadHelpers, /monitoringOutcomeLabels/);
  assert.match(leadHelpers, /not_ready_to_preorder_reason/);
  assert.match(leadHelpers, /"survey_flow"/);
  assert.match(adminPage, /monitoringOutcomeLabels\[qualification\.monitoringOutcome\]/);
  assert.doesNotMatch(adminPage, /\? "Maybe"/);
  assert.doesNotMatch(leadHelpers, /toLocaleLowerCase\(\) !== "suvan"/);
  assert.match(leadHelpers, /return signups\.map\(categorizeSignup\)/);
  assert.match(workbookRoute, /"New survey leads"/);
  assert.match(workbookRoute, /"Previous survey leads"/);
  assert.match(workbookRoute, /"Unqualified leads"/);
  assert.match(workbookRoute, /entry\.surveyFlow === section/);
  assert.match(workbookRoute, /categorizeVisibleSignups\(data \?\? \[\]\)/);
  assert.match(workbookRoute, /frame-subscribers\.xlsx/);
  assert.match(csvRoute, /\.select\(WAITLIST_SIGNUP_SELECT\)/);
  assert.match(deleteRoute, /\.from\("waitlist_signups"\)[\s\S]*\.delete\(\)/);
  assert.match(css, /\.admin-tabs\s*\{/);
  assert.match(css, /\.admin-tabs a\.is-active/);
  assert.match(css, /\.admin-delete\s*\{/);
});
