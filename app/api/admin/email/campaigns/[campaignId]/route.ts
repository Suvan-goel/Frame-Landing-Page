import { emailApiJson, requireEmailAdmin } from "@/lib/admin-email-api.server";
import { getEmailCampaignDetail } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const { campaignId } = await context.params;
  if (!UUID_PATTERN.test(campaignId)) {
    return emailApiJson({ error: "Campaign not found." }, 404);
  }
  try {
    return emailApiJson({ campaign: await getEmailCampaignDetail(campaignId) });
  } catch {
    return emailApiJson({ error: "Campaign not found." }, 404);
  }
}
