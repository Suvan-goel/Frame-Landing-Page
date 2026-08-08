import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  EMAIL_MAX_RECIPIENTS,
  validateEmailCampaignContent,
} from "@/lib/admin-email";
import { sendWaitlistEmailCampaign } from "@/lib/admin-email.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  const user = await getChatGPTUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401);
  if (!(await isWaitlistAdmin(user.email))) {
    return jsonResponse({ error: "Not authorized." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const rawRecipientIds = payload.recipientIds;
  if (!Array.isArray(rawRecipientIds)) {
    return jsonResponse({ error: "Choose at least one recipient." }, 400);
  }
  const recipientIds = [...new Set(rawRecipientIds)].filter(
    (value): value is number =>
      typeof value === "number" && Number.isSafeInteger(value) && value > 0,
  );
  if (recipientIds.length !== rawRecipientIds.length) {
    return jsonResponse({ error: "The recipient selection is invalid." }, 400);
  }
  if (recipientIds.length === 0) {
    return jsonResponse({ error: "Choose at least one recipient." }, 400);
  }
  if (recipientIds.length > EMAIL_MAX_RECIPIENTS) {
    return jsonResponse(
      { error: `Choose no more than ${EMAIL_MAX_RECIPIENTS} recipients at once.` },
      400,
    );
  }

  const contentResult = validateEmailCampaignContent({
    subject: payload.subject,
    previewText: payload.previewText,
    body: payload.body,
    ctaLabel: payload.ctaLabel,
    ctaUrl: payload.ctaUrl,
  });
  if (!contentResult.ok) {
    return jsonResponse({ error: contentResult.error }, 400);
  }

  try {
    const result = await sendWaitlistEmailCampaign({
      createdBy: user.email,
      recipientIds,
      content: contentResult.content,
    });
    return jsonResponse(result, result.failedCount ? 207 : 200);
  } catch (error) {
    console.error("Waitlist email campaign failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("One or more selected recipients")) {
      return jsonResponse({ error: message }, 409);
    }
    if (message === "Email delivery is not configured yet.") {
      return jsonResponse({ error: message }, 503);
    }
    return jsonResponse(
      { error: "The email could not be sent. No retry was started automatically." },
      503,
    );
  }
}
