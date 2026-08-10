import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { runPreorderPaymentReconciliation } from "../lib/preorder-payment-reconciliation.server.ts";

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

const environment = process.argv.includes("--test") ? "test" : "live";
const stripeSecretKey =
  environment === "live"
    ? process.env.STRIPE_LIVE_SECRET_KEY ?? ""
    : process.env.STRIPE_TEST_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const expectedStripePrefix = new RegExp(`^(?:sk|rk)_${environment}_`);

console.log(`Frame pre-order ${environment} payment reconciliation\n`);

if (!supabaseUrl || !supabaseSecretKey || !expectedStripePrefix.test(stripeSecretKey)) {
  console.log(
    `FAIL  Credentials: Supabase service credentials and a dedicated ${environment} Stripe key are required.`,
  );
  console.log("\nNOT RECONCILED: 1 failure. No payment, refund, order or setting was changed.");
  process.exitCode = 1;
} else {
  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const result = await runPreorderPaymentReconciliation({
      supabase,
      stripe,
      environment,
    });
    const currency = (result.summary.currency ?? "usd").toUpperCase();
    const money = (amount) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount / 100);

    console.log(
      `INFO  Scope: ${result.summary.storedOrders} stored order${result.summary.storedOrders === 1 ? "" : "s"}; ${result.summary.stripePaidSessions} paid Stripe session${result.summary.stripePaidSessions === 1 ? "" : "s"}.`,
    );
    console.log(
      `INFO  Totals: stored ${money(result.summary.grossStored)} gross / ${money(result.summary.refundedStored)} refunded; Stripe ${money(result.summary.grossStripe)} gross / ${money(result.summary.refundedStripe)} refunded.`,
    );
    console.log(
      `INFO  Disputes: ${result.summary.activeDisputes} active or lost dispute${result.summary.activeDisputes === 1 ? "" : "s"}.`,
    );
    if (result.ready) {
      console.log(
        "PASS  Reconciliation: every paid Stripe pre-order maps to matching checkout, order and payment records.",
      );
    } else {
      for (const issue of result.issues) {
        const context = issue.orderNumber
          ? `order FR-${String(issue.orderNumber).padStart(4, "0")}`
          : issue.checkoutSessionId
            ? `session ${issue.checkoutSessionId}`
            : "global";
        console.log(`FAIL  ${issue.code} (${context}): ${issue.message}`);
      }
    }
    console.log(
      `\n${result.ready ? "RECONCILED" : "NOT RECONCILED"}: ${result.issues.length} mismatch${result.issues.length === 1 ? "" : "es"}. No payment, refund, order or setting was changed.`,
    );
    process.exitCode = result.ready ? 0 : 1;
  } catch (error) {
    console.log(
      `FAIL  Reconciliation access: ${error instanceof Error ? error.message : "The comparison could not be completed."}`,
    );
    console.log("\nNOT RECONCILED: comparison incomplete. No payment, refund, order or setting was changed.");
    process.exitCode = 1;
  }
}
