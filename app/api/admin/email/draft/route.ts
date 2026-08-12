import {
  emailApiJson,
  hasAllowedRequestOrigin,
  readJsonPayload,
  requireEmailAdmin,
} from "@/lib/admin-email-api.server";
import { deleteEmailCampaignDraft, saveEmailCampaignDraft } from "@/lib/admin-email.server";
import type { EmailCampaignContent } from "@/lib/admin-email";

export const dynamic = "force-dynamic";

function draftContent(payload: Record<string, unknown>): EmailCampaignContent | null {
  const content = payload.content;
  if (!content || typeof content !== "object") return null;
  const value = content as Record<string, unknown>;
  if (
    typeof value.subject !== "string" ||
    typeof value.previewText !== "string" ||
    typeof value.body !== "string" ||
    typeof value.ctaLabel !== "string" ||
    typeof value.ctaUrl !== "string" ||
    (value.ctaPosition !== undefined && typeof value.ctaPosition !== "string")
  ) return null;
  return {
    subject: value.subject,
    previewText: value.previewText,
    body: value.body,
    ctaLabel: value.ctaLabel,
    ctaUrl: value.ctaUrl,
    ctaPosition:
      typeof value.ctaPosition === "string" ? value.ctaPosition as EmailCampaignContent["ctaPosition"] : "end",
  };
}

export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) {
    return emailApiJson({ error: "Request origin is not allowed." }, 403);
  }
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  const payload = await readJsonPayload(request);
  const content = payload ? draftContent(payload) : null;
  const recipientIds = Array.isArray(payload?.recipientIds)
    ? payload.recipientIds.filter(
        (value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0,
      )
    : [];
  const previewRecipientId =
    typeof payload?.previewRecipientId === "number" ? payload.previewRecipientId : null;
  if (!content) return emailApiJson({ error: "Invalid draft." }, 400);
  try {
    return emailApiJson(
      await saveEmailCampaignDraft({
        createdBy: authorization.user.email,
        content,
        recipientIds,
        previewRecipientId,
      }),
    );
  } catch {
    return emailApiJson({ error: "The draft could not be saved." }, 503);
  }
}

export async function DELETE(request: Request) {
  const authorization = await requireEmailAdmin(request);
  if ("response" in authorization) return authorization.response;
  try {
    await deleteEmailCampaignDraft(authorization.user.email);
    return emailApiJson({ status: "deleted" });
  } catch {
    return emailApiJson({ error: "The draft could not be deleted." }, 503);
  }
}
