import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "@/lib/stripe-webhook-events.server";
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processing.server";
import { verifyStripeWebhook } from "@/lib/stripe.server";
import { getRequestExecutionContext } from "vinext/shims/request-context";

export const dynamic = "force-dynamic";

async function processClaimedEvent(event: Awaited<ReturnType<typeof verifyStripeWebhook>>, origin: string) {
  try {
    await processStripeWebhookEvent(event, origin);
    await completeStripeWebhookEvent(event.id);
    return true;
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    try {
      await failStripeWebhookEvent(event.id, error);
    } catch (recordingError) {
      console.error("Stripe webhook failure recording failed", recordingError);
    }
    return false;
  }
}

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

    const processingTask = processClaimedEvent(event, new URL(request.url).origin);
    const executionContext = getRequestExecutionContext();
    if (executionContext) {
      executionContext.waitUntil(processingTask);
      return Response.json({ received: true, queued: true }, { status: 202 });
    }

    if (await processingTask) {
      return Response.json({ received: true });
    }
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  } catch (error) {
    console.error("Stripe webhook intake failed", error);
    return Response.json({ error: "Webhook intake failed." }, { status: 500 });
  }
}
