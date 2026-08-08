import {
  emailApiJson,
  parseEmailContent,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import { sendTestEmail } from "@/lib/admin-email.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const payload = await readJsonPayload(request);
  if (!payload) return emailApiJson({ error: "Invalid request." }, 400);
  const content = parseEmailContent(payload);
  if (!content) return emailApiJson({ error: "Complete the email before sending a test." }, 400);
  try {
    return emailApiJson(
      await sendTestEmail({ createdBy: authorization.user.email, content }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The test email could not be sent.";
    return emailApiJson({ error: message }, 503);
  }
}
