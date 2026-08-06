import type Stripe from "stripe";
import {
  fulfillContributorCheckout,
  reconcileDispute,
  reconcileRefund,
} from "@/lib/contributor-payments.server";
import {
  fulfillPreorderCheckout,
  reconcilePreorderDispute,
  reconcilePreorderRefund,
} from "@/lib/preorder-payments.server";
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
          if (session.metadata?.flow === "frame_preorder") {
            await fulfillPreorderCheckout(session, origin);
          } else if (session.metadata?.membership === "frame_founding_contributor") {
            await fulfillContributorCheckout(session, origin);
          }
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const intentId = session.metadata?.checkout_intent_id;
        if (intentId) {
          const table = session.metadata?.flow === "frame_preorder"
            ? "preorder_checkout_intents"
            : session.metadata?.membership === "frame_founding_contributor"
              ? "contributor_checkout_intents"
              : null;
          if (table) {
            await supabase
              .from(table)
              .update({ status: "expired", updated_at: new Date().toISOString() })
              .eq("id", intentId);
          }
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const id = paymentIntentId(charge.payment_intent);
        if (id) {
          const preorderHandled = await reconcilePreorderRefund({
            paymentIntentId: id,
            amountRefunded: charge.amount_refunded,
            fullyRefunded: charge.refunded,
          });
          if (!preorderHandled && charge.refunded) {
            await reconcileRefund(id, "refunded");
          }
        }
        break;
      }
      case "refund.failed": {
        const refund = event.data.object as Stripe.Refund;
        const id = paymentIntentId(refund.payment_intent);
        if (id) {
          const preorderHandled = await reconcilePreorderRefund({
            paymentIntentId: id,
            amountRefunded: 0,
            fullyRefunded: false,
            failed: true,
          });
          if (!preorderHandled) await reconcileRefund(id, "refund_failed");
        }
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const id = paymentIntentId(dispute.payment_intent);
        if (id) {
          const preorderHandled = await reconcilePreorderDispute(id, true);
          if (!preorderHandled) await reconcileDispute(id, true);
        }
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const id = paymentIntentId(dispute.payment_intent);
        if (id && dispute.status === "won") {
          const preorderHandled = await reconcilePreorderDispute(id, false);
          if (!preorderHandled) await reconcileDispute(id, false);
        }
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
