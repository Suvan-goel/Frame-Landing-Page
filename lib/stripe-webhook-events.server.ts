import type Stripe from "stripe";
import { getSupabaseAdmin } from "./supabase-admin.server";

type WebhookEventClaim = {
  duplicate: boolean;
  processing_attempts: number;
};

const WEBHOOK_STALE_AFTER_SECONDS = 300;

export async function beginStripeWebhookEvent(event: Stripe.Event) {
  const supabase = await getSupabaseAdmin();
  const claimed = await supabase.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_stale_after_seconds: WEBHOOK_STALE_AFTER_SECONDS,
  });
  if (claimed.error) throw claimed.error;

  const claim = claimed.data?.[0] as WebhookEventClaim | undefined;
  if (!claim) {
    throw new Error("Stripe webhook claim did not return a result.");
  }

  return {
    duplicate: claim.duplicate,
    processingAttempts: claim.processing_attempts,
  };
}

export async function completeStripeWebhookEvent(eventId: string) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      error_message: null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (result.error) throw result.error;
}

export async function failStripeWebhookEvent(eventId: string, error: unknown) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      error_message:
        error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
    })
    .eq("event_id", eventId);
  if (result.error) throw result.error;
}
