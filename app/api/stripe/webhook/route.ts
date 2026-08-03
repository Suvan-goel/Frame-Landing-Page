import type Stripe from "stripe";
import {
  fulfillContributorCheckout,
  reconcileDispute,
  reconcileRefund,
} from "@/lib/contributor-payments.server";
import { verifyStripeWebhook } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

function paymentIntentId(value: string | Stripe.PaymentIntent | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Stripe signature is required." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(rawBody, signature);
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  const existing = await supabase
    .from("stripe_webhook_events")
    .select("status")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existing.data?.status === "processed") {
    return Response.json({ received: true, duplicate: true });
  }

  await supabase.from("stripe_webhook_events").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      status: "processing",
      error_message: null,
      received_at: new Date().toISOString(),
      processed_at: null,
    },
    { onConflict: "event_id" },
  );

  try {
    const origin = new URL(request.url).origin;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await fulfillContributorCheckout(session, origin);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const intentId = session.metadata?.checkout_intent_id;
        if (intentId) {
          await supabase
            .from("contributor_checkout_intents")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", intentId);
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const id = paymentIntentId(charge.payment_intent);
        if (id && charge.refunded) await reconcileRefund(id, "refunded");
        break;
      }
      case "refund.failed": {
        const refund = event.data.object as Stripe.Refund;
        const id = paymentIntentId(refund.payment_intent);
        if (id) await reconcileRefund(id, "refund_failed");
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const id = paymentIntentId(dispute.payment_intent);
        if (id) await reconcileDispute(id, true);
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const id = paymentIntentId(dispute.payment_intent);
        if (id && dispute.status === "won") await reconcileDispute(id, false);
        break;
      }
      default:
        break;
    }

    await supabase
      .from("stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", event.id);
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    await supabase
      .from("stripe_webhook_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      })
      .eq("event_id", event.id);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
