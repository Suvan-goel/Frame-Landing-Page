import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { formatName } from "../lib/name-format.ts";
import { createPreorderStagingAccessToken } from "../lib/preorder-staging-access.ts";
import {
  captureWaitlistEmail,
  completeWaitlistQualification,
  skipWaitlistQualification,
} from "../lib/waitlist-service.server.ts";

async function render(path = "/", init, origin = "http://localhost", env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`${origin}${path}`, init ?? {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function createRenderSession(origin = "http://localhost", env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("session", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return (path, init) =>
    worker.fetch(
      new Request(`${origin}${path}`, init),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        ...env,
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
}

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
        qualificationStatus: "not_started",
        surveyCompletedAt: null,
        attribution: input,
        qualification: null,
      };
      records.push(record);
      return record;
    },
    async findByToken(signupToken) {
      return records.find((record) => record.signupToken === signupToken) ?? null;
    },
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
  };
  return { repository, records };
}

function waitlistEmailInput(email) {
  return {
    email,
    placement: "homepage_hero",
    utmSource: "meta",
    utmMedium: "paid_social",
    utmCampaign: "launch",
    utmContent: "creative_a",
    utmTerm: null,
    metaClickId: "meta-click-id",
    referrer: "https://example.com/campaign",
  };
}

test("server-renders the Frame landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Frame \| Ultrasound Wearable for Blood Pressure Patterns<\/title>/i,
  );
  assert.match(
    html,
    /See how your cardiovascular system responds to daily life\./,
  );
  assert.match(html, /Currently in development/);
  assert.match(
    html,
    /Continuous monitoring should create context, not continuous\s*(?:<!-- -->)?conclusions\./,
  );
  assert.match(html, /Research approach/);
  assert.match(html, /Evidence before claims\./);
  assert.match(html, /Signal integrity/);
  assert.match(html, /Research and engineering inquiries/);
  assert.match(html, /A pre-order reserves a future device; the estimated delivery date may change\./);
  assert.match(html, /frame-product-concept-realistic-v3-transparent-720w\.webp/);
  assert.match(html, /frame-hero-man-transparent-v3-720w\.webp/);
  assert.match(html, /frame-sensing-concept-realistic-v3-transparent-960w\.webp/);
  assert.match(html, /frame-app-studio-v5-640w\.webp/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /Frame Health Technologies/);
  assert.doesNotMatch(html, /facebook\.com\/tr\?id=/);
  assert.match(html, /Join Frame early access/);
  assert.match(html, /Get development updates and the opportunity to help shape Frame/);
  assert.equal(html.match(/name="email"/g)?.length, 2);
  assert.equal(html.match(/Join early access/g)?.length >= 2, true);
  assert.match(html, /href="#homepage-hero-waitlist"/);
  assert.doesNotMatch(html, /What is the main reason you want Frame\?/);
  assert.doesNotMatch(html, /<dialog/i);
  assert.match(html, /<section class="final-cta" id="early-access">/);
  assert.doesNotMatch(html, /id="footer-waitlist-/);
  assert.match(html, /href="https:\/\/www\.instagram\.com\/framewearable\/"/);
  assert.match(html, /Frame on Instagram \(opens in a new tab\)/);
  assert.equal(html.match(/href="\/contact(?:\?topic=research)?"/g)?.length, 3);
  assert.doesNotMatch(html, /mailto:support@framewearable\.com/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the dedicated interest page", async () => {
  const response = await render("/interest");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Join Frame early access/);
  assert.match(html, /Get development updates and the opportunity to help shape Frame/);
  assert.match(html, /name="email"/);
  assert.match(html, /Join early access/);
  assert.match(html, /aria-label="Back to home"/);
  assert.doesNotMatch(html, /<dialog/i);
});

test("server-renders the contact page", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Contact Frame<\/title>/i);
  assert.match(html, /Start a conversation\./);
  assert.match(html, /How can we help\?/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="topic"/);
  assert.match(html, /name="message"/);
  assert.match(html, /support@framewearable\.com/);
  assert.match(html, /aria-label="Frame home"/);
});

test("server-renders the Founding Contributor funnel locally", async () => {
  const [membershipResponse, reviewResponse, successResponse, signInResponse] =
    await Promise.all([
      render("/founding-contributors"),
      render("/founding-contributors/review"),
      render("/founding-contributors/success"),
      render("/contributors/sign-in"),
    ]);

  assert.equal(membershipResponse.status, 200);
  const membership = await membershipResponse.text();
  assert.match(membership, /Help build Frame from the beginning\./);
  assert.match(membership, /\$99 once/);
  assert.match(membership, /No automatic renewal/);
  assert.match(membership, /12 months of community access/);
  assert.match(membership, /share your perspective, and help shape what comes next/);
  assert.match(membership, /Membership only—does not include or reserve a Frame device/);
  assert.doesNotMatch(membership, /founding-disclosure/);
  assert.match(membership, /A thank-you for joining us early\./);
  assert.match(membership, /10% off at launch, up to \$50/);
  assert.match(membership, /Benefits depend on a commercial launch/);
  assert.match(membership, /Follow Frame’s development from the inside\./);
  assert.match(membership, /Monthly development updates with access to the full archive/);
  assert.match(membership, /Priority consideration for voluntary research opportunities/);
  assert.match(membership, /Now building an integrated prototype\./);
  assert.match(membership, /Initial measurement validation/);
  assert.match(membership, /Investigated whether ultrasound could capture useful arterial information\./);
  assert.match(membership, /Next proposed stage/);
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
  assert.match(review, /this is a membership, not a Frame device order/);
  assert.match(review, /not ordering, reserving, pre-ordering/);
  assert.match(review, /Membership refund period/);
  assert.match(review, /14 days/);
  assert.match(review, /Continue to secure checkout — \$99/);
  assert.match(review, /Automatic tax is disabled during testing/);
  assert.doesNotMatch(review, /facebook\.com\/tr\?id=/);

  assert.equal(successResponse.status, 200);
  assert.match(await successResponse.text(), /activating your membership/i);
  assert.equal(signInResponse.status, 200);
  assert.match(await signInResponse.text(), /Sign in to the contributor hub/);
});

test("routes the local pre-order funnel to production-ready customer pages and draft policies", async () => {
  const [homeResponse, entryResponse, reviewResponse, successResponse, manageResponse, termsResponse, refundsResponse, successSource] =
    await Promise.all([
      render("/"),
      render("/preorder"),
      render("/preorder/review"),
      render("/preorder/success"),
      render("/preorder/manage"),
      render("/preorder/terms"),
      render("/preorder/refunds"),
      readFile(new URL("../app/components/preorder-success.tsx", import.meta.url), "utf8"),
    ]);

  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.match(home, /href="\/preorder\/review\?source=homepage"/);
  assert.match(home, /Reserve one of the first Frames/);
  assert.match(home, /Review your pre-order/);
  assert.doesNotMatch(home, /pre-order test|local pre-order implementation/i);
  assert.doesNotMatch(home, /href="\/preorder(?:[?"])/);

  assert.equal(entryResponse.status, 307);
  assert.equal(
    entryResponse.headers.get("location"),
    "http://localhost/preorder/review?source=preorder_redirect",
  );

  assert.equal(reviewResponse.status, 200);
  const review = await reviewResponse.text();
  assert.match(review, /Review your Frame pre-order/);
  assert.match(review, /Your pre-order/);
  assert.match(review, /Due today/);
  assert.match(review, /Before you continue/);
  assert.match(review, /Frame is still in development/);
  assert.match(review, /Continue to secure checkout — \$299/);
  assert.match(review, /January 1, 2027/);
  assert.match(review, /Secure payment is provided by Stripe/);
  assert.doesNotMatch(review, /draft|local test|test checkout|test payment/i);
  assert.doesNotMatch(review, /facebook\.com\/tr\?id=/);

  assert.equal(successResponse.status, 200);
  assert.match(await successResponse.text(), /confirming your pre-order/i);
  assert.match(successSource, /Your Frame pre-order is confirmed/);
  assert.match(successSource, /What happens next/);
  assert.doesNotMatch(successSource, /local pre-order flow|signed webhook|Open owner view|Run another test|Stripe test dashboard/i);

  assert.equal(manageResponse.status, 200);
  assert.match(await manageResponse.text(), /Loading your order/i);

  assert.equal(termsResponse.status, 200);
  assert.match(await termsResponse.text(), /Implementation draft — not approved for live sales/);
  assert.equal(refundsResponse.status, 200);
  assert.match(await refundsResponse.text(), /Draft Refund Workflow/);
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
    "/preorder",
    "/preorder/review",
    "/preorder/success",
    "/preorder/manage",
    "/preorder/terms",
    "/preorder/refunds",
    "/preorder/staging-access",
    "/preorder/staging-exit",
    "/preorders",
    "/admin/preorders",
    "/api/preorders/checkout",
    "/api/preorders/status",
    "/api/preorders/manage",
    "/api/admin/preorders/example/operations",
    "/api/admin/preorders.csv",
    "/preorder%2Freview",
    "/og-founding-contributors.png",
    "/contributors%2Fterms",
    "/_vinext/image?url=%2Fog-founding-contributors.png&w=1200&q=75",
  ];
  const responses = await Promise.all(
    restrictedPaths.map((path) => render(path, undefined, publicOrigin)),
  );

  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 404, restrictedPaths[index]);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await response.text(), /not found/i);
  }

  const [homeResponse, privacyResponse, sitemapResponse] = await Promise.all([
    render("/", undefined, publicOrigin),
    render("/privacy", undefined, publicOrigin),
    render("/sitemap.xml", undefined, publicOrigin),
  ]);
  const publicHome = await homeResponse.text();
  const publicPrivacy = await privacyResponse.text();
  const publicSitemap = await sitemapResponse.text();

  assert.equal(homeResponse.status, 200);
  assert.doesNotMatch(publicHome, /Founding Contributors/);
  assert.doesNotMatch(publicHome, /href="\/founding-contributors/);
  assert.doesNotMatch(publicHome, /Pre-order test|href="\/preorder/);
  assert.doesNotMatch(publicPrivacy, /Founding Contributor|contributor hub|membership/i);
  assert.doesNotMatch(publicPrivacy, /pre-order testing|test payments and shipping-address/i);
  assert.doesNotMatch(publicSitemap, /founding-contributors/);
  assert.doesNotMatch(publicSitemap, /preorder/);
});

test("keeps private pre-order staging behind a revocable test-mode cookie", async () => {
  const origin = "https://frame-staging.example";
  const secret = "private-staging-test-secret-0123456789abcdef";
  const stagingEnv = {
    PREORDER_MODE: "test",
    PREORDER_STAGING_ACCESS_SECRET: secret,
  };
  const accessToken = await createPreorderStagingAccessToken(secret);
  assert.doesNotMatch(accessToken, new RegExp(secret));

  const [withoutAccess, invalidAccess, liveModeAccess] = await Promise.all([
    render("/preorder/review", undefined, origin, stagingEnv),
    render(
      "/preorder/staging-access?token=incorrect",
      undefined,
      origin,
      stagingEnv,
    ),
    render(
      `/preorder/staging-access?token=${encodeURIComponent(accessToken)}`,
      undefined,
      origin,
      { ...stagingEnv, PREORDER_MODE: "live" },
    ),
  ]);
  assert.equal(withoutAccess.status, 404);
  assert.equal(invalidAccess.status, 404);
  assert.equal(liveModeAccess.status, 404);

  const access = await render(
    `/preorder/staging-access?token=${encodeURIComponent(accessToken)}`,
    undefined,
    origin,
    stagingEnv,
  );
  assert.equal(access.status, 303);
  assert.equal(
    access.headers.get("location"),
    "/preorder/review?source=private_staging",
  );
  const setCookie = access.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /frame_preorder_staging=v1\./);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.doesNotMatch(setCookie, new RegExp(secret));
  const cookie = setCookie.split(";")[0];
  const tamperedCookie = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;

  const [review, home, webhook, tampered] = await Promise.all([
    render(
      "/preorder/review",
      { headers: { accept: "text/html", cookie } },
      origin,
      stagingEnv,
    ),
    render(
      "/",
      { headers: { accept: "text/html", cookie } },
      origin,
      stagingEnv,
    ),
    render(
      "/api/stripe/webhook",
      { method: "POST", body: "{}" },
      origin,
      stagingEnv,
    ),
    render(
      "/preorder/review",
      { headers: { accept: "text/html", cookie: tamperedCookie } },
      origin,
      stagingEnv,
    ),
  ]);
  assert.equal(review.status, 200);
  assert.match(await review.text(), /Private staging · Stripe test mode · no live charge/);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Review your pre-order/);
  assert.equal(webhook.status, 400);
  assert.match(await webhook.text(), /Stripe signature is required/);
  assert.equal(tampered.status, 404);

  const exit = await render(
    "/preorder/staging-exit",
    { headers: { cookie } },
    origin,
    stagingEnv,
  );
  assert.equal(exit.status, 303);
  assert.match(exit.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("renders draft contributor policies and keeps member routes private", async () => {
  const [terms, refunds, productStatus, hub, onboarding] = await Promise.all([
    render("/contributors/terms"),
    render("/contributors/refunds"),
    render("/contributors/product-status"),
    render("/contributors"),
    render("/contributors/onboarding"),
  ]);

  assert.match(await terms.text(), /Draft for testing — not approved for live sales/);
  assert.match(await refunds.text(), /Full refund within 14 days/);
  assert.match(await productStatus.text(), /No finished Frame product currently exists/);
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

test("uses generated raster visuals and keeps the page editable", async () => {
  const [
    page,
    layout,
    css,
    api,
    supabase,
    privacy,
    demographicsMigration,
    interestFlow,
    waitlistFlow,
    waitlistMigration,
    interestPage,
    metaPixel,
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
      new URL("../app/components/interest-flow.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/waitlist-signup-flow.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260806140000_email_first_waitlist.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/interest/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/meta-pixel.tsx", import.meta.url),
      "utf8",
    ),
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
  assert.match(page, /src="\/frame-hero-man-transparent-v3-720w\.webp"/);
  assert.match(
    page,
    /src="\/frame-hero-man-transparent-v3-720w\.webp"[\s\S]*?width=\{1089\}[\s\S]*?height=\{1444\}/,
  );
  assert.match(css, /\.hero-visuals\s*\{[\s\S]*?top: 12px;/);
  assert.doesNotMatch(css, /\.hero-lifestyle\s*\{[^}]*transform:/);
  assert.match(
    css,
    /\.hero-lifestyle img\s*\{[^}]*height: 98\.398125%;[^}]*transform: translate\(-144px, 76px\);/,
  );
  assert.match(page, /src="\/frame-sensing-concept-realistic-v3-transparent-960w\.webp"/);
  assert.match(page, /src="\/frame-app-studio-v5-640w\.webp"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(waitlistFlow, /fetch\("\/api\/waitlist"/);
  assert.doesNotMatch(interestFlow, /<dialog|showModal\(|OPEN_INTEREST_FLOW_EVENT/);
  assert.match(interestPage, /showFoundingContributorOffer=/);
  assert.match(interestPage, /isFoundingContributorSalesPageEnabled\(\)/);
  assert.match(interestPage, /canonical: "\/interest"/);
  assert.match(waitlistFlow, /Join Frame early access/);
  assert.match(waitlistFlow, /action: "capture_email"/);
  assert.match(waitlistFlow, /setStage\("invitation"\)/);
  assert.match(waitlistFlow, /You’re on the list\./);
  assert.match(waitlistFlow, /Your place is already secured/);
  assert.match(waitlistFlow, /Skip and finish/);
  assert.match(waitlistFlow, /action: "submit_qualification"/);
  assert.match(waitlistFlow, /researchCall === "yes"/);
  assert.match(waitlistFlow, /First name/);
  assert.doesNotMatch(waitlistFlow, /Last name|name="age"|name="gender"/);
  assert.match(waitlistFlow, /frustration\.trim\(\)/);
  assert.doesNotMatch(waitlistFlow, /minLength=/);
  assert.match(page, /WaitlistSignupProvider/);
  assert.match(page, /placement="homepage_hero"/);
  assert.match(page, /placement="homepage_final" tone="light"/);
  assert.doesNotMatch(page, /href="\/interest"/);
  assert.match(api, /formatName\(value\)\.slice/);
  assert.match(api, /captureWaitlistEmail/);
  assert.match(api, /completeWaitlistQualification/);
  assert.match(api, /skipWaitlistQualification/);
  assert.match(api, /leadCreated/);
  assert.match(waitlistFlow, /result\.leadCreated === true/);
  assert.match(waitlistFlow, /result\.qualifiedLeadCreated === true/);
  assert.match(waitlistFlow, /waitlist_email_success/);
  assert.match(waitlistFlow, /qualification_completed/);
  assert.match(
    metaPixel,
    /window\.fbq\("trackSingle", META_PIXEL_ID, "Lead"/,
  );
  assert.match(metaPixel, /"trackSingleCustom", META_PIXEL_ID, "QualifiedLead"/);
  assert.match(metaPixel, /frame-meta-lead-recorded-v1/);
  assert.match(metaPixel, /eventName.*recordKey/s);
  assert.match(metaPixel, /1068997465474786/);
  assert.match(metaPixel, /PRIVATE_PREFIXES = \["\/contributors", "\/admin", "\/api"\]/);
  assert.match(metaPixel, /"\/founding-contributors\/review"/);
  assert.match(metaPixel, /"\/founding-contributors\/success"/);
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
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.waitlist-signup__email-row/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.waitlist-signup__email-row/);
  assert.match(api, /from\("waitlist_signups"\)[\s\S]*?\.insert/);
  assert.match(api, /signup_referrer/);
  assert.match(api, /meta_click_id/);
  assert.match(waitlistMigration, /add column if not exists survey_token uuid/);
  assert.match(waitlistMigration, /add column if not exists qualification_status text/);
  assert.match(waitlistMigration, /survey_completed_at timestamptz/);
  assert.match(waitlistMigration, /where qualification_status is null/);
  assert.doesNotMatch(waitlistMigration, /drop table|drop column|delete from/i);
  assert.match(supabase, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(page, /SUPABASE_SECRET_KEY|createClient/);
  assert.match(demographicsMigration, /add column if not exists gender text/);
  assert.match(demographicsMigration, /add column if not exists age smallint/);
  assert.match(privacy, /We do not sell your information\./);
  assert.match(privacy, /We use the Meta Pixel/);
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

test("rejects invalid email capture before storage", async () => {
  const response = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "capture_email", email: "not-an-email" }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /valid email/i);
});

test("completes the local email-first API flow without external credentials", async () => {
  const email = `local-preview-${process.pid}@example.com`;
  const localRender = await createRenderSession();
  const captureResponse = await localRender("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "capture_email",
      email,
      placement: "homepage_hero",
      utmSource: "local_test",
    }),
  });
  assert.equal(captureResponse.status, 201);
  const captured = await captureResponse.json();
  assert.equal(captured.status, "joined");
  assert.equal(captured.leadCreated, true);
  assert.match(captured.signupToken, /^[0-9a-f-]{36}$/i);

  const duplicateResponse = await localRender("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "capture_email", email }),
  });
  assert.equal(duplicateResponse.status, 200);
  const duplicate = await duplicateResponse.json();
  assert.equal(duplicate.status, "already_registered");
  assert.equal(duplicate.leadCreated, false);
  assert.equal(duplicate.signupToken, captured.signupToken);

  const surveyResponse = await localRender("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit_qualification",
      signupToken: captured.signupToken,
      primaryInterest: "understand_daily_factors",
      monitoringMethod: "upper_arm_occasionally",
      frustration: "I only get occasional readings.",
      researchCall: "yes",
      firstName: "Ada",
    }),
  });
  assert.equal(surveyResponse.status, 200);
  assert.deepEqual(await surveyResponse.json(), {
    status: "completed",
    qualifiedLeadCreated: true,
  });

  const repeatedSurvey = await localRender("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "submit_qualification",
      signupToken: captured.signupToken,
      primaryInterest: "understand_daily_factors",
      monitoringMethod: "upper_arm_occasionally",
    }),
  });
  assert.equal(repeatedSurvey.status, 200);
  assert.deepEqual(await repeatedSurvey.json(), {
    status: "already_completed",
    qualifiedLeadCreated: false,
  });
});

test("captures email before the optional survey and treats duplicates as success", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const input = waitlistEmailInput("person@example.com");

  const captured = await captureWaitlistEmail(repository, input);
  assert.equal(captured.status, "joined");
  assert.equal(captured.leadCreated, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].qualificationStatus, "not_started");
  assert.equal(records[0].qualification, null);
  assert.equal(records[0].attribution.utmCampaign, "launch");

  const duplicate = await captureWaitlistEmail(repository, input);
  assert.equal(duplicate.status, "already_registered");
  assert.equal(duplicate.leadCreated, false);
  assert.equal(duplicate.signupToken, captured.signupToken);
  assert.equal(records.length, 1);
});

test("skips the optional survey without changing waitlist membership", async () => {
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

test("associates survey answers with the correct email and completes only once", async () => {
  const { repository, records } = createWaitlistRepositoryFixture();
  const first = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("first@example.com"),
  );
  const second = await captureWaitlistEmail(
    repository,
    waitlistEmailInput("second@example.com"),
  );
  const answers = {
    primaryInterest: "understand_daily_factors",
    primaryInterestOther: null,
    monitoringMethod: "upper_arm_occasionally",
    monitoringMethodOther: null,
    frustration: "Occasional readings lack everyday context.",
    researchCall: "yes",
    firstName: "Ada",
    completedAt: "2026-08-06T12:05:00.000Z",
  };

  const completed = await completeWaitlistQualification(
    repository,
    second.signupToken,
    answers,
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.qualifiedLeadCreated, true);
  assert.equal(records.find((record) => record.email === "first@example.com").qualification, null);
  assert.deepEqual(
    records.find((record) => record.email === "second@example.com").qualification,
    answers,
  );

  const repeated = await completeWaitlistQualification(
    repository,
    second.signupToken,
    answers,
  );
  assert.equal(repeated.status, "already_completed");
  assert.equal(repeated.qualifiedLeadCreated, false);
  assert.notEqual(first.signupToken, second.signupToken);
});

test("surfaces waitlist storage failures without inventing a successful capture", async () => {
  const { repository } = createWaitlistRepositoryFixture();
  repository.findByEmail = async () => {
    throw new Error("database unavailable");
  };
  await assert.rejects(
    captureWaitlistEmail(repository, waitlistEmailInput("error@example.com")),
    /database unavailable/,
  );
});

test("requires explicit membership acknowledgment before checkout", async () => {
  const response = await render("/api/founding-contributors/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ acknowledged: false }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /not ordering or reserving a Frame device/i);
});

test("requires both pre-order acknowledgements before checkout", async () => {
  const productStatusResponse = await render("/api/preorders/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productStatusAcknowledged: false,
      termsAcknowledged: false,
    }),
  });
  assert.equal(productStatusResponse.status, 400);
  assert.match(await productStatusResponse.text(), /still in development/i);

  const termsResponse = await render("/api/preorders/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productStatusAcknowledged: true,
      termsAcknowledged: false,
    }),
  });
  assert.equal(termsResponse.status, 400);
  assert.match(await termsResponse.text(), /Pre-order Terms/i);
});

test("completes the default local pre-order preview without external payment configuration", async () => {
  const checkoutResponse = await render("/api/preorders/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productStatusAcknowledged: true,
      termsAcknowledged: true,
      marketingOptIn: false,
      quantity: 1,
    }),
  });
  assert.equal(checkoutResponse.status, 200);
  assert.deepEqual(await checkoutResponse.json(), {
    url: "http://localhost/preorder/success?preview=1",
  });

  const statusResponse = await render("/api/preorders/status?preview=1", {
    headers: { accept: "application/json" },
  });
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.status, "confirmed");
  assert.equal(status.order.orderNumber, "FR-TEST-0001");
  assert.equal(status.order.amountPaidCents, 29900);
  assert.equal(status.order.estimatedDelivery, "January 1, 2027");
});

test("routes Stripe events by commerce flow and keeps pre-order fulfilment separate", async () => {
  const [webhook, webhookProcessing, checkout, payments, migration, access] = await Promise.all([
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/stripe-webhook-processing.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-payments.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260804000000_add_preorders.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-access.ts", import.meta.url), "utf8"),
  ]);

  assert.match(webhook, /processStripeWebhookEvent/);
  assert.match(webhookProcessing, /session\.metadata\?\.flow === "frame_preorder"/);
  assert.match(webhookProcessing, /fulfillPreorderCheckout/);
  assert.match(webhookProcessing, /membership === "frame_founding_contributor"/);
  assert.match(checkout, /idempotencyKey: `frame-preorder-checkout-/);
  assert.match(checkout, /shipping_address_collection/);
  assert.match(checkout, /startsWith\("sk_test_"\)/);
  assert.match(payments, /preorder_order_items/);
  assert.match(payments, /confirmation_email_failed/);
  assert.match(migration, /create table if not exists public\.preorders/);
  assert.match(migration, /create table if not exists public\.preorder_payments/);
  assert.match(migration, /create table if not exists public\.preorder_events/);
  assert.match(access, /!isDraftPreorderVersion\(PREORDER_TERMS_VERSION\)/);
});

test("separates pre-order environments and enforces owner-controlled capacity", async () => {
  const [migration, checkout, payments, admin, controls, access, launchReadiness] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260806000000_add_preorder_sales_controls.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/api/preorders/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-payments.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/preorders/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/admin/preorders/controls/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/preorder-access.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(migration, /create table if not exists public\.preorder_sales_controls/);
  assert.match(migration, /create or replace function public\.reserve_preorder_checkout/);
  assert.match(migration, /\('live', 'paused', null\)/);
  assert.match(migration, /alter table public\.preorder_sales_controls enable row level security/);
  assert.match(checkout, /reservePreorderCheckout/);
  assert.match(checkout, /requestKey/);
  assert.match(checkout, /environment,/);
  assert.match(payments, /intent\.environment !== environment/);
  assert.match(admin, /\.eq\("environment", environment\)/);
  assert.match(controls, /Live sales cannot be opened until every launch safeguard passes/);
  assert.match(controls, /evaluatePreorderLaunchReadiness/);
  assert.match(access, /"\/api\/admin\/preorders"/);
  assert.match(launchReadiness, /startsWith\("sk_live_"\)/);
  assert.match(launchReadiness, /stripe\.prices\.retrieve/);
  assert.match(launchReadiness, /Customer email delivery is not configured/);
  assert.match(launchReadiness, /Order-link and endpoint-protection secrets must be different/);
});

test("adds auditable owner operations and signed customer cancellation requests", async () => {
  const [
    migration,
    accessTokens,
    customerManagement,
    manageApi,
    adminOperations,
    refundApi,
    adminPage,
    email,
  ] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260806010000_add_preorder_order_operations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/preorder-order-access.server.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/preorder-customer-management.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/preorder-admin-operations.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/admin/preorders/[id]/refund/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/admin/preorders/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /cancellation_status text not null default 'none'/);
  assert.match(migration, /manage_token_version integer not null default 1/);
  assert.match(migration, /tracking_number text/);
  assert.match(accessTokens, /HMAC/);
  assert.match(accessTokens, /expiresAt/);
  assert.match(customerManagement, /cancellation_status: "requested"/);
  assert.doesNotMatch(customerManagement, /getStripe|refunds\.create/);
  assert.match(manageApi, /requestPreorderCancellation/);
  assert.match(adminOperations, /stripe\.refunds\.create/);
  assert.match(adminOperations, /payment_status: "refund_pending"/);
  assert.match(adminOperations, /sendPreorderShippingEmail/);
  assert.match(refundApi, /authorizePreorderAdminApi/);
  assert.match(adminPage, /requireChatGPTUser/);
  assert.match(adminPage, /PreorderOrderOperations/);
  assert.match(email, /Manage your pre-order/);
  assert.doesNotMatch(email, /Local test only|draft terms|not approved for live sales/);
});

test("hardens public pre-order endpoints and adds authenticated recovery and export tools", async () => {
  const [
    migration,
    rateLimit,
    checkout,
    manage,
    webhook,
    retry,
    admin,
    exportRoute,
  ] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260806020000_add_preorder_launch_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/preorder-rate-limit.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/api/admin/preorders/webhooks/[eventId]/retry/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/admin/preorders/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/preorders.csv/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table if not exists public\.preorder_rate_limits/);
  assert.match(migration, /create or replace function public\.consume_preorder_rate_limit/);
  assert.match(migration, /processing_attempts integer not null default 0/);
  assert.match(rateLimit, /HMAC/);
  assert.doesNotMatch(rateLimit, /insert.*clientAddress|subject_hash: clientAddress/s);
  assert.match(checkout, /scope: "preorder_checkout"/);
  assert.match(manage, /scope: "preorder_manage_mutation"/);
  assert.match(webhook, /beginStripeWebhookEvent/);
  assert.match(retry, /authorizePreorderAdminApi/);
  assert.match(retry, /Only failed events can be retried/);
  assert.match(admin, /PreorderWebhookRecovery/);
  assert.match(admin, /Download CSV/);
  assert.match(exportRoute, /isWaitlistAdmin/);
  assert.match(exportRoute, /formula|\^\[=\+\\-@\]/i);
});

test("claims Stripe webhooks atomically and provides a sandbox concurrency suite", async () => {
  const [migration, webhookEvents, retry, reliability, packageJson] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260806040000_add_atomic_stripe_webhook_claims.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/stripe-webhook-events.server.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/api/admin/preorders/webhooks/[eventId]/retry/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../scripts/test-preorder-reliability.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create or replace function public\.claim_stripe_webhook_event/);
  assert.match(migration, /on conflict \(event_id\) do nothing/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_event\.status = 'processed'/);
  assert.match(migration, /make_interval\(secs => p_stale_after_seconds\)/);
  assert.match(webhookEvents, /rpc\("claim_stripe_webhook_event"/);
  assert.doesNotMatch(webhookEvents, /maybeSingle<WebhookEventRow>/);
  assert.match(retry, /claim\.duplicate/);
  assert.match(reliability, /PREORDER_MODE === "test"/);
  assert.match(reliability, /Live pre-orders must remain paused/);
  assert.match(reliability, /Array\.from\(\{ length: 10 \}/);
  assert.match(reliability, /synthetic checkout cleanup/);
  assert.match(packageJson, /preorder:test:reliability/);
});

test("adds customer address changes, delivery acknowledgements, and lifecycle notifications", async () => {
  const [
    migration,
    customerManagement,
    manageApi,
    adminOperations,
    operationsApi,
    adminPage,
    email,
    payments,
  ] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260806030000_add_preorder_customer_change_workflows.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../lib/preorder-customer-management.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/preorders/manage/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/preorder-admin-operations.server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/admin/preorders/[id]/operations/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/admin/preorders/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-payments.server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /current_estimated_delivery text/);
  assert.match(migration, /address_change_status text not null default 'none'/);
  assert.match(migration, /delivery_update_version integer not null default 0/);
  assert.match(customerManagement, /requestPreorderAddressChange/);
  assert.match(customerManagement, /respondToPreorderDeliveryUpdate/);
  assert.match(customerManagement, /sendPreorderOwnerActionEmail/);
  assert.match(manageApi, /request_address_change/);
  assert.match(manageApi, /respond_delivery_update/);
  assert.match(adminOperations, /resolvePreorderAddressChange/);
  assert.match(adminOperations, /sendPreorderDeliveryUpdate/);
  assert.match(adminOperations, /Resolve the shipping-address request before shipping/);
  assert.match(operationsApi, /approve_address_change/);
  assert.match(operationsApi, /send_delivery_update/);
  assert.match(adminPage, /current_estimated_delivery/);
  assert.match(email, /sendPreorderCancellationDeclinedEmail/);
  assert.match(email, /sendPreorderAddressChangeResolutionEmail/);
  assert.match(email, /sendPreorderDeliveryUpdateEmail/);
  assert.match(payments, /sendPreorderRefundUpdateEmail/);
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

test("validates the optional survey without requiring demographics", async () => {
  const baseSurvey = {
    action: "submit_qualification",
    signupToken: "11111111-1111-4111-8111-111111111111",
  };

  const missingInterest = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseSurvey),
  });
  assert.equal(missingInterest.status, 400);
  assert.match(await missingInterest.text(), /main reason/i);

  const invalidMonitoring = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...baseSurvey,
      primaryInterest: "understand_daily_factors",
      monitoringMethod: "invalid",
    }),
  });
  assert.equal(invalidMonitoring.status, 400);
  assert.match(await invalidMonitoring.text(), /currently monitor/i);

  const missingCallName = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...baseSurvey,
      primaryInterest: "understand_daily_factors",
      monitoringMethod: "upper_arm_occasionally",
      researchCall: "yes",
    }),
  });
  assert.equal(missingCallName.status, 400);
  assert.match(await missingCallName.text(), /first name/i);
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
  assert.match(contactApi, /const CONTACT_EMAIL = "support@framewearable\.com"/);
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

test("separates, visualizes, exports, and permanently deletes admin leads", async () => {
  const [adminPage, insights, leadHelpers, workbookRoute, deleteRoute, css] = await Promise.all([
    readFile(new URL("../app/admin/waitlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/waitlist/qualified-lead-insights.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/waitlist-leads.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist.xlsx/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(leadHelpers, /type LeadTab = "qualified" \| "unqualified"/);
  assert.match(adminPage, /Qualified leads/);
  assert.match(adminPage, /Unqualified leads/);
  assert.match(adminPage, /Lead insights/);
  assert.match(adminPage, /tab=insights/);
  assert.match(adminPage, /What Frame should help with/);
  assert.match(adminPage, /Export spreadsheet/);
  assert.match(adminPage, /Manage hidden test entries/);
  assert.match(adminPage, /DeleteWaitlistSignupButton/);
  assert.match(insights, /admin-age-chart/);
  assert.match(insights, /admin-donut/);
  assert.match(insights, /Multiple-choice responses/);
  assert.match(leadHelpers, /isQualifiedSignup/);
  assert.match(leadHelpers, /qualification_status: QualificationStatus/);
  assert.match(leadHelpers, /Email captured · survey not completed/);
  assert.match(leadHelpers, /highIntent/);
  assert.match(leadHelpers, /survey_completed_at/);
  assert.match(
    leadHelpers,
    /signup\.first_name\?\.trim\(\)\.toLocaleLowerCase\(\) !== "suvan"/,
  );
  assert.match(workbookRoute, /"Qualified leads"/);
  assert.match(workbookRoute, /"Unqualified leads"/);
  assert.match(workbookRoute, /categorizeVisibleSignups\(data \?\? \[\]\)/);
  assert.match(workbookRoute, /frame-waitlist\.xlsx/);
  assert.match(deleteRoute, /\.from\("waitlist_signups"\)[\s\S]*\.delete\(\)/);
  assert.match(css, /\.admin-tabs\s*\{/);
  assert.match(css, /\.admin-tabs a\.is-active/);
  assert.match(css, /\.admin-delete\s*\{/);
});
