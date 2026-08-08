import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  EMAIL_MAX_RECIPIENTS,
  validateEmailCampaignContent,
  type EmailCampaignContent,
} from "./admin-email";
import { isWaitlistAdmin } from "./supabase-admin.server";

export function emailApiJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function hasAllowedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function requireEmailAdmin(request: Request) {
  if (!hasAllowedRequestOrigin(request)) {
    return { response: emailApiJson({ error: "Request origin is not allowed." }, 403) } as const;
  }
  const user = await getChatGPTUser();
  if (!user) {
    return { response: emailApiJson({ error: "Authentication required." }, 401) } as const;
  }
  if (!(await isWaitlistAdmin(user.email))) {
    return { response: emailApiJson({ error: "Not authorized." }, 403) } as const;
  }
  return { user } as const;
}

export async function readJsonPayload(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseRecipientIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  const recipientIds = [...new Set(value)].filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  );
  if (
    recipientIds.length !== value.length ||
    recipientIds.length === 0 ||
    recipientIds.length > EMAIL_MAX_RECIPIENTS
  ) {
    return null;
  }
  return recipientIds;
}

export function parseEmailContent(payload: Record<string, unknown>): EmailCampaignContent | null {
  const result = validateEmailCampaignContent({
    subject: payload.subject,
    previewText: payload.previewText,
    body: payload.body,
    ctaLabel: payload.ctaLabel,
    ctaUrl: payload.ctaUrl,
  });
  return result.ok ? result.content : null;
}
