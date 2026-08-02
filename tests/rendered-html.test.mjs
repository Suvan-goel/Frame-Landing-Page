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
  assert.match(html, /frame-product-concept-realistic-v3-transparent\.png/);
  assert.match(html, /frame-hero-man-transparent-v2\.png/);
  assert.match(html, /frame-sensing-concept-realistic-v3-transparent\.png/);
  assert.match(html, /frame-app-studio-v5\.png/);
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
  assert.match(html, /aria-label="Back to Frame"/);
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
    readdir(new URL("../public/", import.meta.url)),
  ]);

  assert.match(page, /src="\/frame-product-concept-realistic-v3-transparent\.png"/);
  assert.match(page, /width=\{1254\}\s+height=\{1254\}/);
  assert.match(
    css,
    /\.product-concept-showcase__media img\s*\{[\s\S]*?width: min\(22vw, 240px\);/,
  );
  assert.match(page, /src="\/frame-hero-man-transparent-v2\.png"/);
  assert.match(
    page,
    /src="\/frame-hero-man-transparent-v2\.png"[\s\S]*?width=\{1092\}[\s\S]*?height=\{1440\}/,
  );
  assert.match(css, /\.hero-visuals\s*\{[\s\S]*?top: 12px;/);
  assert.doesNotMatch(css, /\.hero-lifestyle\s*\{[^}]*transform:/);
  assert.match(
    css,
    /\.hero-lifestyle img\s*\{[^}]*height: 98\.398125%;[^}]*transform: translate\(-144px, 76px\);/,
  );
  assert.match(page, /src="\/frame-sensing-concept-realistic-v3-transparent\.png"/);
  assert.match(page, /src="\/frame-app-studio-v5\.png"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(interestFlow, /fetch\("\/api\/waitlist"/);
  assert.doesNotMatch(interestFlow, /<dialog|showModal\(|OPEN_INTEREST_FLOW_EVENT/);
  assert.match(interestPage, /<InterestFlow \/>/);
  assert.match(interestPage, /canonical: "\/interest"/);
  assert.match(interestFlow, /MIN_SITUATION_LENGTH = 20/);
  assert.match(
    interestFlow,
    /What would frame solve for you that existing wearables don't\?/,
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
  assert.match(page, /Interested\?/);
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
  assert.deepEqual(
    [
      "frame-app-studio.png",
      "frame-app-studio-v5.png",
      "frame-hero-man-transparent-v2.png",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
      "og-launch-v2.png",
    ].filter(
      (file) => publicFiles.includes(file),
    ),
    [
      "frame-app-studio.png",
      "frame-app-studio-v5.png",
      "frame-hero-man-transparent-v2.png",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
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
  assert.match(privacy, /href="\/contact\?topic=privacy"/);
  assert.doesNotMatch(privacy, /mailto:support@framewearable\.com/);
  assert.match(sitemap, /https:\/\/framewearable\.com/);
  assert.match(sitemap, /`\$\{siteUrl\}\/contact`/);
});
