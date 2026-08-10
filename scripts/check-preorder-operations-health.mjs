import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { runPreorderOperationsHealth } from "../lib/preorder-operations-health.server.ts";

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
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";

console.log(`Frame pre-order ${environment} operations health\n`);

if (!supabaseUrl || !supabaseSecretKey) {
  console.log("FAIL  Credentials: Supabase service credentials are required.");
  console.log(
    "\nPAUSE SALES: health check incomplete. No webhook, email, order, refund, inventory or setting was changed.",
  );
  process.exitCode = 1;
} else {
  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await runPreorderOperationsHealth({
      supabase,
      environment,
    });
    const summary = result.summary;
    console.log(
      `INFO  Orders: ${summary.orders} total; ${summary.activePaidOrders} active paid.`,
    );
    console.log(
      `INFO  Recovery: ${summary.unresolvedWebhooks} webhook; ${summary.unresolvedEmailStreams} email; ${summary.unresolvedCancellations} cancellation/refund; ${summary.overdueDeliveryActions} overdue delivery action.`,
    );
    console.log(
      `INFO  Inventory: ${summary.paidUnits} paid + ${summary.reservedUnits} reserved of ${summary.unitLimit} released / ${summary.inventoryLimit} lifetime units.`,
    );
    if (result.healthy) {
      console.log(
        "PASS  Operations: no failed or stalled work and all inventory totals agree.",
      );
    } else {
      for (const issue of result.issues) {
        const context = issue.orderNumber
          ? `order FR-${String(issue.orderNumber).padStart(4, "0")}`
          : issue.reference
            ? issue.reference
            : "global";
        console.log(`FAIL  ${issue.code} (${context}): ${issue.message}`);
      }
    }
    console.log(
      `\n${result.healthy ? "SAFE TO ACCEPT ORDERS" : "PAUSE SALES"}: ${result.issues.length} operational issue${result.issues.length === 1 ? "" : "s"}. No webhook, email, order, refund, inventory or setting was changed.`,
    );
    process.exitCode = result.healthy ? 0 : 1;
  } catch (error) {
    console.log(
      `FAIL  Operations access: ${error instanceof Error ? error.message : "The health check could not be completed."}`,
    );
    console.log(
      "\nPAUSE SALES: health check incomplete. No webhook, email, order, refund, inventory or setting was changed.",
    );
    process.exitCode = 1;
  }
}
