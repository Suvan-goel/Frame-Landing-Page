import {
  emailApiJson,
  parseEmailContent,
  parseRecipientIds,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import { createEmailSendConfirmation } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const payload = await readJsonPayload(request);
  if (!payload) return emailApiJson({ error: "Invalid request." }, 400);
  const recipientIds = parseRecipientIds(payload.recipientIds);
  const content = parseEmailContent(payload);
  if (!recipientIds || !content) {
    return emailApiJson({ error: "Complete the email and choose a valid audience." }, 400);
  }
  try {
    return emailApiJson(
      await createEmailSendConfirmation({
        createdBy: authorization.user.email,
        recipientIds,
        content,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign review could not be created.";
    return emailApiJson({ error: message }, 409);
  }
}
