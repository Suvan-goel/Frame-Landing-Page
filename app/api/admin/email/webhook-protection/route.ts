import {
  emailApiJson,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import {
  configureResendWebhookProtection,
  getResendWebhookProtectionStatus,
} from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

const RESEND_SIGNING_SECRET_PATTERN = /^whsec_[A-Za-z0-9+/=_-]{20,200}$/;

export async function GET(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  try {
    return emailApiJson(await getResendWebhookProtectionStatus());
  } catch (error) {
    console.error("Resend webhook status check failed", error);
    return emailApiJson({ error: "Protection status could not be checked." }, 503);
  }
}

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const payload = await readJsonPayload(request);
  const signingSecret =
    typeof payload?.signingSecret === "string" ? payload.signingSecret.trim() : "";
  if (!RESEND_SIGNING_SECRET_PATTERN.test(signingSecret)) {
    return emailApiJson(
      { error: "Paste the Resend signing secret beginning with whsec_." },
      400,
    );
  }
  try {
    return emailApiJson(
      await configureResendWebhookProtection({
        signingSecret,
        configuredBy: authorization.user.email,
      }),
    );
  } catch (error) {
    console.error("Resend webhook protection configuration failed", error);
    return emailApiJson(
      { error: "The signing secret could not be saved. No email was sent." },
      503,
    );
  }
}
