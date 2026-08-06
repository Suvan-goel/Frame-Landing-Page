import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "@/lib/stripe-webhook-events.server";
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processing.server";
import { verifyStripeWebhook } from "@/lib/stripe.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Stripe signature is required." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = await verifyStripeWebhook(rawBody, signature);
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const processing = await beginStripeWebhookEvent(event);
    if (processing.duplicate) {
      return Response.json({ received: true, duplicate: true });
    }

    await processStripeWebhookEvent(event, new URL(request.url).origin);
    await completeStripeWebhookEvent(event.id);
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    try {
      await failStripeWebhookEvent(event.id, error);
    } catch (recordingError) {
      console.error("Stripe webhook failure recording failed", recordingError);
    }
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
