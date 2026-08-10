import { readFile } from "node:fs/promises";
import {
  evaluatePreorderEmailReadiness,
  getPreorderEmailDnsSnapshot,
  PREORDER_EMAIL_REPLY_TO,
} from "../lib/preorder-email-readiness.ts";

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

const operationsRecipient =
  process.env.PREORDER_OPERATIONS_EMAIL?.trim() ||
  process.env.WAITLIST_ADMIN_EMAILS?.split(",")
    .map((email) => email.trim())
    .find(Boolean);
let dns = null;
try {
  dns = await getPreorderEmailDnsSnapshot();
} catch {
  dns = null;
}

const checks = evaluatePreorderEmailReadiness({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.PREORDER_FROM_EMAIL,
  operationsRecipient,
  replyTo: PREORDER_EMAIL_REPLY_TO,
  dns,
});

console.log("Frame pre-order email readiness\n");
for (const check of checks) {
  console.log(
    `${check.ready ? "PASS" : "FAIL"}  ${check.name}: ${check.ready ? check.readyDetail : check.blocker}`,
  );
}
const failures = checks.filter((check) => !check.ready).length;
console.log(
  `\n${failures ? "NOT READY" : "READY"}: ${failures} failure${failures === 1 ? "" : "s"}. No email was sent and no setting was changed.`,
);
process.exitCode = failures ? 1 : 0;
