import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { formatName } from "../lib/name-format.ts";

async function render(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init ?? {
      headers: { accept: "text/html" },
    }),
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
}

test("server-renders the Frame landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Frame - Blood pressure in context<\/title>/i);
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
  assert.match(html, /Frame is under development and is not currently available for sale\./);
  assert.match(html, /frame-product-concept-realistic-v3-transparent\.webp/);
  assert.match(html, /frame-hero-man-transparent-v3\.webp/);
  assert.match(html, /frame-sensing-concept-realistic-v3-transparent\.webp/);
  assert.match(html, /frame-app-studio-v5\.webp/);
  assert.doesNotMatch(html, /facebook\.com\/tr\?id=/);
  assert.equal(html.match(/href="\/interest"/g)?.length, 3);
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

  assert.match(html, /Register your interest/);
  assert.match(html, /What is the main reason you want Frame\?/);
  assert.match(html, /Monitor high or borderline blood pressure without repeated cuff readings/);
  assert.match(html, /Understand my blood pressure while sleeping/);
  assert.match(html, /name="mainReason"/);
  assert.match(html, /type="radio"/);
  assert.match(html, /aria-label="Step 1 of 5"/);
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

test("server-renders the Founding Contributor funnel and disclosures", async () => {
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

  assert.match(page, /src="\/frame-product-concept-realistic-v3-transparent\.webp"/);
  assert.match(page, /width=\{1254\}\s+height=\{1254\}/);
  assert.match(
    css,
    /\.product-concept-showcase__media img\s*\{[\s\S]*?width: min\(24vw, 270px\);/,
  );
  assert.match(page, /src="\/frame-hero-man-transparent-v3\.webp"/);
  assert.match(
    page,
    /src="\/frame-hero-man-transparent-v3\.webp"[\s\S]*?width=\{1089\}[\s\S]*?height=\{1444\}/,
  );
  assert.match(css, /\.hero-visuals\s*\{[\s\S]*?top: 12px;/);
  assert.doesNotMatch(css, /\.hero-lifestyle\s*\{[^}]*transform:/);
  assert.match(
    css,
    /\.hero-lifestyle img\s*\{[^}]*height: 98\.398125%;[^}]*transform: translate\(-144px, 76px\);/,
  );
  assert.match(page, /src="\/frame-sensing-concept-realistic-v3-transparent\.webp"/);
  assert.match(page, /src="\/frame-app-studio-v5\.webp"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(interestFlow, /fetch\("\/api\/waitlist"/);
  assert.doesNotMatch(interestFlow, /<dialog|showModal\(|OPEN_INTEREST_FLOW_EVENT/);
  assert.match(interestPage, /<InterestFlow \/>/);
  assert.match(interestPage, /canonical: "\/interest"/);
  assert.match(interestFlow, /MIN_SITUATION_LENGTH = 20/);
  assert.match(
    interestFlow,
    /What would you want Frame to help you understand or do that you can’t easily today\?/,
  );
  assert.match(interestFlow, /MAX_SITUATION_LENGTH = 750/);
  assert.match(interestFlow, /type="radio"/);
  assert.match(interestFlow, /name="recentSituation"/);
  assert.match(interestFlow, /name="monitoringMethod"/);
  assert.match(interestFlow, /name="interviewWillingness"/);
  assert.match(interestFlow, /name="firstName"/);
  assert.match(interestFlow, /name="lastName"/);
  assert.match(interestFlow, /name="age"/);
  assert.match(interestFlow, /name="gender"/);
  assert.match(interestFlow, /name="email"/);
  assert.doesNotMatch(page, /InterestFlow|InterestTrigger|<WaitlistPopup \/>/);
  assert.match(page, /href="\/interest"/);
  assert.match(page, /I&apos;m interested/);
  assert.match(page, /Register your interest\./);
  assert.match(
    page,
    /Do you think Frame sounds interesting\?[\s\S]*keep you up to date with Frame&apos;s development!/
  );
  assert.match(interestFlow, /Your interest has been registered!/);
  assert.match(
    interestFlow,
    /We genuinely read all responses and[\s\S]*your input is invaluable for Frame&apos;s development\./,
  );
  assert.match(interestFlow, /formatName\(firstName\)/);
  assert.match(api, /return formatName\(value\)/);
  assert.match(api, /MIN_SITUATION_LENGTH = 20/);
  assert.match(api, /MAIN_REASON_VALUES/);
  assert.match(api, /MONITORING_METHOD_VALUES/);
  assert.match(api, /INTERVIEW_WILLINGNESS_VALUES/);
  assert.match(api, /GENDER_VALUES/);
  assert.match(api, /age < MIN_AGE \|\| age > MAX_AGE/);
  assert.match(interestFlow, /window\.localStorage\.setItem/);
  assert.doesNotMatch(interestFlow, /result\.status === "joined"/);
  assert.match(interestFlow, /trackMetaLead\(\)/);
  assert.match(
    metaPixel,
    /window\.fbq\("trackSingle", META_PIXEL_ID, "Lead"/,
  );
  assert.match(metaPixel, /frame-meta-lead-recorded-v1/);
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
  assert.match(layout, /url: `\$\{baseUrl\}\/og-launch-v2\.png`/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(api, /from\("waitlist_signups"\)\.insert/);
  assert.match(api, /first_name: firstName/);
  assert.match(api, /last_name: lastName/);
  assert.match(api, /gender/);
  assert.match(api, /age/);
  assert.match(api, /motivation/);
  assert.match(api, /const qualificationRecord = JSON\.stringify/);
  assert.match(api, /mainReason,/);
  assert.match(api, /recentSituation,/);
  assert.match(api, /monitoringMethod,/);
  assert.match(api, /interviewWillingness,/);
  assert.match(api, /motivation: qualificationRecord/);
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
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /not ordering or reserving a Frame device/i);
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
  assert.match(sitemap, /https:\/\/framewearable\.com/);
  assert.match(sitemap, /`\$\{siteUrl\}\/contact`/);
});

test("separates, exports, and permanently deletes admin leads", async () => {
  const [adminPage, leadHelpers, workbookRoute, deleteRoute, css] = await Promise.all([
    readFile(new URL("../app/admin/waitlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/waitlist-leads.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist.xlsx/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/waitlist/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(leadHelpers, /type LeadTab = "qualified" \| "unqualified"/);
  assert.match(adminPage, /Qualified leads/);
  assert.match(adminPage, /Unqualified leads/);
  assert.match(adminPage, /What Frame should help with/);
  assert.match(adminPage, /Export spreadsheet/);
  assert.match(adminPage, /Manage hidden test entries/);
  assert.match(adminPage, /DeleteWaitlistSignupButton/);
  assert.match(leadHelpers, /isQualifiedSignup/);
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
