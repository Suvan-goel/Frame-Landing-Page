import {
  getResendWebhookSecret,
  processResendWebhookEvent,
} from "@/lib/admin-email.server";
import { verifyResendWebhook } from "@/lib/resend-webhook-signature";

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";
  const payload = await request.text();
  const secret = await getResendWebhookSecret();
  if (!secret) return json({ error: "Webhook is not configured." }, 503);
  if (
    !svixId ||
    !svixTimestamp ||
    !svixSignature ||
    !(await verifyResendWebhook({
      payload,
      secret,
      svixId,
      svixTimestamp,
      svixSignature,
    }))
  ) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let event: {
    type: string;
    created_at?: string;
    data?: { email_id?: string; to?: string[] };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }
  if (!event || typeof event.type !== "string") {
    return json({ error: "Invalid webhook payload." }, 400);
  }
  try {
    return json(await processResendWebhookEvent({ eventId: svixId, event }));
  } catch (error) {
    console.error("Resend webhook processing failed", error);
    return json({ error: "Webhook processing failed." }, 503);
  }
}
