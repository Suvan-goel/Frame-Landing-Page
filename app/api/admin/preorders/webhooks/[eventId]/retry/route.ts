import {
  authorizePreorderAdminApi,
} from "@/lib/preorder-admin-api.server";
import type { PreorderEnvironment } from "@/lib/preorder-operations.server";
import {
  beginStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "@/lib/stripe-webhook-events.server";
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processing.server";
import { getStripe } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_024;

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authorization = await authorizePreorderAdminApi(request);
  if (!authorization.user) {
    return response({ error: authorization.error }, authorization.status);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return response({ error: "Request is too large." }, 413);
  }

  const { eventId } = await params;
  if (!/^evt_[A-Za-z0-9_]{6,250}$/.test(eventId)) {
    return response({ error: "Invalid Stripe event." }, 400);
  }

  let payload: { environment?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return response({ error: "Choose the event environment." }, 400);
  }
  const environment: PreorderEnvironment | null =
    payload.environment === "test" || payload.environment === "live"
      ? payload.environment
      : null;
  if (!environment) return response({ error: "Choose a valid environment." }, 400);

  const supabase = await getSupabaseAdmin();
  const stored = await supabase
    .from("stripe_webhook_events")
    .select("event_id,status,livemode")
    .eq("event_id", eventId)
    .maybeSingle<{ event_id: string; status: string; livemode: boolean }>();
  if (stored.error) {
    console.error("Stripe event recovery lookup failed", stored.error);
    return response({ error: "The failed event could not be loaded." }, 503);
  }
  if (!stored.data) return response({ error: "Stripe event not found." }, 404);
  if (stored.data.status !== "failed") {
    return response({ error: "Only failed events can be retried." }, 409);
  }
  if (stored.data.livemode !== (environment === "live")) {
    return response({ error: "The event belongs to a different environment." }, 409);
  }

  try {
    const stripe = await getStripe();
    const event = await stripe.events.retrieve(eventId);
    if (event.livemode !== stored.data.livemode) {
      return response({ error: "The configured Stripe account does not match this event." }, 409);
    }

    const claim = await beginStripeWebhookEvent(event);
    if (claim.duplicate) {
      return response(
        { error: "The event is already processing or has already been processed." },
        409,
      );
    }
    await processStripeWebhookEvent(event, new URL(request.url).origin);
    await completeStripeWebhookEvent(event.id);
    return response({ status: "processed" });
  } catch (error) {
    console.error("Stripe event recovery failed", error);
    try {
      await failStripeWebhookEvent(eventId, error);
    } catch (recordingError) {
      console.error("Stripe event recovery failure recording failed", recordingError);
    }
    return response(
      { error: "The event could not be recovered. Check Stripe configuration and try again." },
      503,
    );
  }
}
