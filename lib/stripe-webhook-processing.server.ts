import type Stripe from "stripe";
import {
  fulfillContributorCheckout,
  reconcileDispute,
  reconcileRefund,
} from "./contributor-payments.server";
import {
  fulfillPreorderCheckout,
  reconcilePreorderDispute,
  reconcilePreorderRefund,
} from "./preorder-payments.server";
import { getStripe } from "./stripe.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function reconcileRefundObject(
  event: Stripe.Event,
  refund: Stripe.Refund,
  origin: string,
) {
  const paymentIntentId = stripeId(refund.payment_intent);
  if (!paymentIntentId) return;

  if (event.type === "refund.failed" || refund.status === "failed") {
    const preorderHandled = await reconcilePreorderRefund({
      paymentIntentId,
      amountRefunded: 0,
      fullyRefunded: false,
      failed: true,
      origin,
    });
    if (!preorderHandled) await reconcileRefund(paymentIntentId, "refund_failed");
    return;
  }

  const chargeId = stripeId(refund.charge);
  if (!chargeId) return;
  const stripe = await getStripe(event.livemode ? "live" : "test");
  const charge = await stripe.charges.retrieve(chargeId);
  const preorderHandled = await reconcilePreorderRefund({
    paymentIntentId,
    amountRefunded: charge.amount_refunded,
    fullyRefunded: charge.refunded,
    origin,
  });
  if (!preorderHandled && charge.refunded) {
    await reconcileRefund(paymentIntentId, "refunded");
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  origin: string,
) {
  const supabase = await getSupabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        if (["frame_preorder", "frame_reservation"].includes(session.metadata?.flow ?? "")) {
          await fulfillPreorderCheckout(session, origin);
        } else if (
          session.metadata?.membership === "frame_founding_contributor"
        ) {
          await fulfillContributorCheckout(session, origin);
        }
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const intentId = session.metadata?.checkout_intent_id;
      if (intentId) {
        const table =
          ["frame_preorder", "frame_reservation"].includes(session.metadata?.flow ?? "")
            ? "preorder_checkout_intents"
            : session.metadata?.membership === "frame_founding_contributor"
              ? "contributor_checkout_intents"
              : null;
        if (table) {
          const result = await supabase
            .from(table)
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", intentId);
          if (result.error) throw result.error;
        }
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const id = stripeId(charge.payment_intent);
      if (id) {
        const preorderHandled = await reconcilePreorderRefund({
          paymentIntentId: id,
          amountRefunded: charge.amount_refunded,
          fullyRefunded: charge.refunded,
          origin,
        });
        if (!preorderHandled && charge.refunded) {
          await reconcileRefund(id, "refunded");
        }
      }
      break;
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const refund = event.data.object as Stripe.Refund;
      await reconcileRefundObject(event, refund, origin);
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const id = stripeId(dispute.payment_intent);
      if (id) {
        const preorderHandled = await reconcilePreorderDispute(id, true);
        if (!preorderHandled) await reconcileDispute(id, true);
      }
      break;
    }
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const id = stripeId(dispute.payment_intent);
      if (id && dispute.status === "won") {
        const preorderHandled = await reconcilePreorderDispute(id, false);
        if (!preorderHandled) await reconcileDispute(id, false);
      }
      break;
    }
    default:
      break;
  }
}
