import {
  emailApiJson,
  parseEmailContent,
  parseRecipientIds,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import { sendWaitlistEmailCampaign } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;

  const payload = await readJsonPayload(request);
  if (!payload) return emailApiJson({ error: "Invalid request." }, 400);
  const recipientIds = parseRecipientIds(payload.recipientIds);
  if (!recipientIds) {
    return emailApiJson({ error: "Choose a valid recipient audience." }, 400);
  }
  const content = parseEmailContent(payload);
  if (!content) return emailApiJson({ error: "Review the email content." }, 400);
  const confirmationId =
    typeof payload.confirmationId === "string" ? payload.confirmationId : "";
  const confirmationText =
    typeof payload.confirmationText === "string" ? payload.confirmationText : "";
  if (!UUID_PATTERN.test(confirmationId) || !confirmationText) {
    return emailApiJson(
      { error: "Review and explicitly confirm the campaign before sending." },
      400,
    );
  }

  try {
    const result = await sendWaitlistEmailCampaign({
      createdBy: authorization.user.email,
      recipientIds,
      content,
      confirmationId,
      confirmationText,
    });
    return emailApiJson(result, result.failedCount ? 207 : 200);
  } catch (error) {
    console.error("Waitlist email campaign failed", error);
    const message = error instanceof Error ? error.message : "";
    if (
      message.startsWith("One or more selected recipients") ||
      message.startsWith("This campaign review") ||
      message.startsWith("Type SEND")
    ) {
      return emailApiJson({ error: message }, 409);
    }
    if (
      message === "Email delivery is not configured yet." ||
      message.startsWith("Add Frame’s valid postal address") ||
      message.startsWith("Enable bounce")
    ) {
      return emailApiJson({ error: message }, 503);
    }
    return emailApiJson(
      { error: "The email could not be sent. No retry was started automatically." },
      503,
    );
  }
}
