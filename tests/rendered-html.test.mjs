import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

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
  assert.match(html, /Continuous monitoring does not mean continuous guessing\./);
  assert.match(html, /Research-stage technology/);
  assert.match(html, /Frame is under development and is not currently available for sale\./);
  assert.match(html, /frame-product-concept-realistic-v3-transparent\.png/);
  assert.match(html, /frame-on-arm-editorial-v3\.png/);
  assert.match(html, /frame-sensing-concept-realistic-v3-transparent\.png/);
  assert.match(html, /frame-app-studio-v4\.png/);
  assert.match(html, /We’ll only contact you about Frame\./);
  assert.match(html, /name="firstName"/);
  assert.match(html, /name="lastName"/);
  assert.match(html, /name="motivation"/);
  assert.match(html, /How would you use Frame\?/);
  assert.match(html, /Minimum\s*(?:<!-- -->)?30(?:<!-- -->)? characters/);
  assert.match(html, /maxlength="500"/i);
  assert.match(html, /All fields are required\./);
  assert.match(html, /Apply for early access/);
  assert.match(html, /class="button button--dark" href="#early-access"/);
  assert.match(html, /<section class="final-cta" id="early-access">/);
  assert.match(html, /Frame early access/);
  assert.match(html, /Tell us how Frame could fit into your life\./);
  assert.match(html, /No spam\./);
  assert.match(html, /aria-label="Close waitlist signup"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="https:\/\/www\.instagram\.com\/framewearable\/"/);
  assert.match(html, /Frame on Instagram \(opens in a new tab\)/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("uses generated raster visuals and keeps the page editable", async () => {
  const [page, layout, css, api, supabase, privacy, publicFiles] =
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
    readdir(new URL("../public/", import.meta.url)),
  ]);

  assert.match(page, /src="\/frame-product-concept-realistic-v3-transparent\.png"/);
  assert.match(page, /src="\/frame-on-arm-editorial-v3\.png"/);
  assert.match(page, /src="\/frame-sensing-concept-realistic-v3-transparent\.png"/);
  assert.match(page, /src="\/frame-app-studio-v4\.png"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(page, /fetch\("\/api\/waitlist"/);
  assert.match(page, /dialog\.showModal\(\)/);
  assert.match(page, /placement="popup"/);
  assert.match(page, /WAITLIST_PROMPT_DELAY_MS = 12_000/);
  assert.match(page, /WAITLIST_SCROLL_THRESHOLD = 0\.4/);
  assert.match(page, /MAX_MOTIVATION_LENGTH = 500/);
  assert.match(api, /MAX_MOTIVATION_LENGTH = 500/);
  assert.match(page, /window\.sessionStorage\.setItem/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /window\.dispatchEvent\(new Event\(WAITLIST_JOINED_EVENT\)\)/);
  assert.doesNotMatch(page, /Connect a real waitlist API/);
  assert.match(layout, /url: `\$\{baseUrl\}\/og-launch-v2\.png`/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(api, /from\("waitlist_signups"\)\.insert/);
  assert.match(api, /first_name: firstName/);
  assert.match(api, /last_name: lastName/);
  assert.match(api, /motivation/);
  assert.match(supabase, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(page, /SUPABASE_SECRET_KEY|createClient/);
  assert.match(privacy, /We do not sell your information\./);
  assert.deepEqual(
    [
      "frame-app-studio.png",
      "frame-app-studio-v4.png",
      "frame-on-arm-editorial-v3.png",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
      "og-launch-v2.png",
    ].filter(
      (file) => publicFiles.includes(file),
    ),
    [
      "frame-app-studio.png",
      "frame-app-studio-v4.png",
      "frame-on-arm-editorial-v3.png",
      "frame-product-concept-realistic-v3-transparent.png",
      "frame-sensing-concept-realistic-v2.png",
      "frame-sensing-concept-realistic-v3-transparent.png",
      "og-launch-v2.png",
    ],
  );
});

test("rejects incomplete waitlist applications before storage", async () => {
  const response = await render("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com" }),
  });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /first name/i);
});
