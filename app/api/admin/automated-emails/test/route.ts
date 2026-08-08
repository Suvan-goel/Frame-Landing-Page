import {
  emailApiJson,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import {
  isAutomatedEmailPreviewId,
} from "@/lib/automated-email-previews";
import { sendAutomatedEmailPreviewTest } from "@/lib/automated-email-previews.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const payload = await readJsonPayload(request);
  if (!payload || !isAutomatedEmailPreviewId(payload.previewId)) {
    return emailApiJson({ error: "Choose a valid automated email preview." }, 400);
  }

  try {
    await sendAutomatedEmailPreviewTest({
      previewId: payload.previewId,
      recipient: authorization.user.email,
    });
    return emailApiJson({
      message: `Test sent only to ${authorization.user.email}.`,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The automated email preview could not be sent.";
    return emailApiJson({ error: message }, 503);
  }
}
