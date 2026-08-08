import { readFile } from "node:fs/promises";
import { createPreorderStagingAccessToken } from "../lib/preorder-staging-access.ts";

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

const secret = process.env.PREORDER_STAGING_ACCESS_SECRET ?? "";
if (secret.length < 32) {
  console.error("PREORDER_STAGING_ACCESS_SECRET must be at least 32 characters.");
  process.exit(1);
}

const requestedOrigin = process.argv[2];
let origin;
try {
  origin = new URL(requestedOrigin);
} catch {
  console.error("Provide the HTTPS origin of the private staging site.");
  process.exit(1);
}
if (origin.protocol !== "https:" || origin.username || origin.password) {
  console.error("The private staging origin must be a credential-free HTTPS URL.");
  process.exit(1);
}

const token = await createPreorderStagingAccessToken(secret);
const accessUrl = new URL("/preorder/staging-access", origin.origin);
accessUrl.searchParams.set("token", token);
console.log(accessUrl.toString());
console.log("This staging link expires in 30 minutes. The resulting browser access expires in 12 hours.");
