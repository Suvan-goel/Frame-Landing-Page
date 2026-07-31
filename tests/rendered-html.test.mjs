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
  assert.match(html, /<title>Frame — Blood pressure in context<\/title>/i);
  assert.match(
    html,
    /See how your cardiovascular system responds to daily life\./,
  );
  assert.match(html, /Currently in development/);
  assert.match(html, /Continuous monitoring does not mean continuous guessing\./);
  assert.match(html, /Research-stage technology/);
  assert.match(html, /Frame is under development and is not currently available for sale\./);
  assert.match(html, /frame-hero\.png/);
  assert.match(html, /frame-ultrasound\.png/);
  assert.match(html, /frame-app\.png/);
  assert.match(html, /Product and research updates only\./);
  assert.match(html, /href="\/privacy"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("uses generated raster visuals and keeps the page editable", async () => {
  const [page, layout, css, schema, api, privacy, hosting, publicFiles] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/waitlist/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readdir(new URL("../public/", import.meta.url)),
  ]);

  assert.match(page, /src="\/frame-hero\.png"/);
  assert.match(page, /src="\/frame-ultrasound\.png"/);
  assert.match(page, /src="\/frame-app\.png"/);
  assert.doesNotMatch(page, /<svg|ProductDiagram|CrossSection|PatternTimeline/);
  assert.match(page, /fetch\("\/api\/waitlist"/);
  assert.doesNotMatch(page, /Connect a real waitlist API/);
  assert.match(layout, /url: `\$\{baseUrl\}\/og-launch\.png`/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(schema, /waitlistSignups/);
  assert.match(api, /INSERT INTO waitlist_signups/);
  assert.match(privacy, /We do not sell your information\./);
  assert.match(hosting, /"d1": "DB"/);
  assert.deepEqual(
    [
      "frame-app.png",
      "frame-hero.png",
      "frame-ultrasound.png",
      "og-launch.png",
    ].filter(
      (file) => publicFiles.includes(file),
    ),
    [
      "frame-app.png",
      "frame-hero.png",
      "frame-ultrasound.png",
      "og-launch.png",
    ],
  );
});
