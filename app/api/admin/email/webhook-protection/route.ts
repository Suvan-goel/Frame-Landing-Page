import { emailApiJson, requireEmailAdmin } from "@/lib/admin-email-api.server";
import { enableResendWebhookProtection } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  try {
    return emailApiJson(await enableResendWebhookProtection());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bounce protection could not be enabled.";
    return emailApiJson({ error: message }, 503);
  }
}
