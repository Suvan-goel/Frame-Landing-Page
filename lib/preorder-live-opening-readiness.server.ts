import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { isPreorderPublicLaunchConfigured } from "./preorder-live-smoke-access";
import {
  evaluatePreorderLiveSmokeEvidence,
  type PreorderLiveSmokeIntentEvidence,
  type PreorderLiveSmokeOrderEvidence,
} from "./preorder-live-opening-readiness";
import { runPreorderOperationsHealth } from "./preorder-operations-health.server";
import { runPreorderPaymentReconciliation } from "./preorder-payment-reconciliation.server";

function orderEvidence(row: Record<string, unknown>): PreorderLiveSmokeOrderEvidence {
  return {
    id: String(row.id),
    checkoutIntentId: String(row.checkout_intent_id),
    environment: String(row.environment),
    paymentStatus: String(row.payment_status),
    amountTotal: Number(row.amount_total),
    amountRefunded: Number(row.amount_refunded),
    confirmationEmailSentAt:
      typeof row.confirmation_email_sent_at === "string"
        ? row.confirmation_email_sent_at
        : null,
  };
}

function intentEvidence(row: Record<string, unknown>): PreorderLiveSmokeIntentEvidence {
  return {
    id: String(row.id),
    environment: String(row.environment),
    status: String(row.status),
    source: typeof row.source === "string" ? row.source : null,
  };
}

export async function verifyPreorderLiveSmokeOrder(input: {
  supabase: SupabaseClient;
  orderId: string;
}) {
  const orderResult = await input.supabase
    .from("preorders")
    .select(
      "id,checkout_intent_id,environment,payment_status,amount_total,amount_refunded,confirmation_email_sent_at",
    )
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderResult.error) throw orderResult.error;
  if (!orderResult.data) {
    return {
      ready: false,
      blocker: "The configured private live-verification order was not found.",
    };
  }

  const order = orderEvidence(orderResult.data as Record<string, unknown>);
  const intentResult = await input.supabase
    .from("preorder_checkout_intents")
    .select("id,environment,status,source")
    .eq("id", order.checkoutIntentId)
    .maybeSingle();
  if (intentResult.error) throw intentResult.error;

  return evaluatePreorderLiveSmokeEvidence({
    order,
    intent: intentResult.data
      ? intentEvidence(intentResult.data as Record<string, unknown>)
      : null,
  });
}

export async function evaluatePreorderLiveOpeningReadiness(input: {
  supabase: SupabaseClient;
  stripe: Stripe;
  publicLaunchEnabled?: string;
  verifiedOrderId?: string;
}) {
  const blockers: string[] = [];
  const [operationsResult, reconciliationResult] = await Promise.allSettled([
    runPreorderOperationsHealth({
      supabase: input.supabase,
      environment: "live",
    }),
    runPreorderPaymentReconciliation({
      supabase: input.supabase,
      stripe: input.stripe,
      environment: "live",
    }),
  ]);

  if (operationsResult.status === "fulfilled") {
    const operations = operationsResult.value;
    if (!operations.healthy) {
      const issueCodes = operations.issues
        .slice(0, 5)
        .map((issue) => issue.code)
        .join(", ");
      blockers.push(
        `Live operations health has ${operations.issues.length} issue${operations.issues.length === 1 ? "" : "s"}${issueCodes ? ` (${issueCodes})` : ""}.`,
      );
    }
  } else {
    blockers.push("Live operations health could not be verified.");
  }

  if (reconciliationResult.status === "fulfilled") {
    const reconciliation = reconciliationResult.value;
    if (!reconciliation.ready) {
      const issueCodes = reconciliation.issues
        .slice(0, 5)
        .map((issue) => issue.code)
        .join(", ");
      blockers.push(
        `Live payment reconciliation has ${reconciliation.issues.length} mismatch${reconciliation.issues.length === 1 ? "" : "es"}${issueCodes ? ` (${issueCodes})` : ""}.`,
      );
    }
  } else {
    blockers.push("Live payment reconciliation could not be verified.");
  }

  if (input.publicLaunchEnabled === "true") {
    if (
      !isPreorderPublicLaunchConfigured({
        enabled: input.publicLaunchEnabled,
        verifiedOrderId: input.verifiedOrderId,
      })
    ) {
      blockers.push(
        "Public launch does not reference a valid private live-verification order.",
      );
    } else {
      try {
        const evidence = await verifyPreorderLiveSmokeOrder({
          supabase: input.supabase,
          orderId: input.verifiedOrderId as string,
        });
        if (!evidence.ready && evidence.blocker) blockers.push(evidence.blocker);
      } catch {
        blockers.push("The private live-verification order could not be verified.");
      }
    }
  }

  return { ready: blockers.length === 0, blockers };
}
