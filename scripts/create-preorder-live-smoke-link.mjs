import { readFile } from "node:fs/promises";
import {
  createPreorderLiveSmokeAccessToken,
  PREORDER_LIVE_SMOKE_ACCESS_PATH,
} from "../lib/preorder-live-smoke-access.ts";

const SITE_URL = "https://framewearable.com";

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

if (process.env.PREORDER_MODE !== "live") {
  console.error("PREORDER_MODE must be live before creating a live-verification link.");
  process.exit(1);
}
if (process.env.PREORDER_PUBLIC_LAUNCH_ENABLED !== "false") {
  console.error("PREORDER_PUBLIC_LAUNCH_ENABLED must be explicitly false for private live verification.");
  process.exit(1);
}
if (process.env.PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID?.trim()) {
  console.error("A live-verification order is already approved; do not create another invitation.");
  process.exit(1);
}

const secret = process.env.PREORDER_LIVE_SMOKE_ACCESS_SECRET ?? "";
if (secret.length < 32) {
  console.error("PREORDER_LIVE_SMOKE_ACCESS_SECRET must be at least 32 characters.");
  process.exit(1);
}

const requestedOrigin = process.argv[2] ?? SITE_URL;
let origin;
try {
  origin = new URL(requestedOrigin);
} catch {
  console.error(`The live-verification origin must be ${SITE_URL}.`);
  process.exit(1);
}
if (origin.origin !== SITE_URL || origin.username || origin.password) {
  console.error(`The live-verification origin must be exactly ${SITE_URL}.`);
  process.exit(1);
}

const token = await createPreorderLiveSmokeAccessToken(secret);
const accessUrl = new URL(PREORDER_LIVE_SMOKE_ACCESS_PATH, SITE_URL);
accessUrl.searchParams.set("token", token);
console.log(accessUrl.toString());
console.log("WARNING: this opens the real Stripe payment path. The invitation expires in 15 minutes and browser access expires in 2 hours.");
