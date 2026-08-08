import {
  emailApiJson,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import { retryFailedEmailCampaign } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const { campaignId } = await context.params;
  const payload = await readJsonPayload(request);
  const confirmationText =
    typeof payload?.confirmationText === "string" ? payload.confirmationText : "";
  if (!UUID_PATTERN.test(campaignId) || !confirmationText) {
    return emailApiJson({ error: "Explicit retry confirmation is required." }, 400);
  }
  try {
    return emailApiJson(
      await retryFailedEmailCampaign({
        campaignId,
        createdBy: authorization.user.email,
        confirmationText,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The retry could not be started.";
    return emailApiJson({ error: message }, 409);
  }
}
