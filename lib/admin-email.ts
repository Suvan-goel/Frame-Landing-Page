export const EMAIL_SUBJECT_MAX_LENGTH = 160;
export const EMAIL_PREVIEW_MAX_LENGTH = 200;
export const EMAIL_BODY_MAX_LENGTH = 20_000;
export const EMAIL_CTA_LABEL_MAX_LENGTH = 80;
export const EMAIL_MAX_RECIPIENTS = 5_000;
export const EMAIL_CONFIRMATION_MINUTES = 10;

export type MailingListRecipient = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  qualificationStatus: string;
  joinedAt: string;
};

export type EmailCampaignDraft = {
  content: EmailCampaignContent;
  recipientIds: number[];
  previewRecipientId: number | null;
  updatedAt: string;
};

export type EmailCampaignRecipientSummary = {
  id: string;
  email: string;
  name: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
};

export type EmailCampaignDetail = EmailCampaignSummary & {
  previewText: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  recipients: EmailCampaignRecipientSummary[];
};

export type EmailDeliveryReadiness = {
  from: string;
  replyTo: string;
  postalAddress: string;
  postalAddressConfigured: boolean;
  webhookConfigured: boolean;
  webhookVerified: boolean;
};

export const RESEND_WEBHOOK_ENDPOINT =
  "https://framewearable.com/api/resend/webhook";

export const RESEND_WEBHOOK_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
] as const;

export type EmailCampaignSummary = {
  id: string;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type EmailCampaignContent = {
  subject: string;
  previewText: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type EmailCampaignValidationResult =
  | { ok: true; content: EmailCampaignContent }
  | { ok: false; error: string };

function cleanSingleLine(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanBody(value: unknown) {
  return typeof value === "string"
    ? value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim()
    : "";
}

export function validateEmailCampaignContent(
  value: Partial<Record<keyof EmailCampaignContent, unknown>>,
): EmailCampaignValidationResult {
  const content: EmailCampaignContent = {
    subject: cleanSingleLine(value.subject),
    previewText: cleanSingleLine(value.previewText),
    body: cleanBody(value.body),
    ctaLabel: cleanSingleLine(value.ctaLabel),
    ctaUrl: cleanSingleLine(value.ctaUrl),
  };

  if (!content.subject) return { ok: false, error: "Add a subject line." };
  if (content.subject.length > EMAIL_SUBJECT_MAX_LENGTH) {
    return { ok: false, error: "The subject line is too long." };
  }
  if (content.previewText.length > EMAIL_PREVIEW_MAX_LENGTH) {
    return { ok: false, error: "The preview text is too long." };
  }
  if (!content.body) return { ok: false, error: "Write the email message." };
  if (content.body.length > EMAIL_BODY_MAX_LENGTH) {
    return { ok: false, error: "The email message is too long." };
  }
  if (content.ctaLabel.length > EMAIL_CTA_LABEL_MAX_LENGTH) {
    return { ok: false, error: "The button label is too long." };
  }
  if (Boolean(content.ctaLabel) !== Boolean(content.ctaUrl)) {
    return {
      ok: false,
      error: "Add both a button label and destination, or leave both blank.",
    };
  }
  if (content.ctaUrl) {
    try {
      const url = new URL(content.ctaUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      return { ok: false, error: "Enter a valid http or https button link." };
    }
  }

  return { ok: true, content };
}

export function personalizeEmailCopy(value: string, firstName: string | null) {
  return value.replaceAll("{{first_name}}", firstName?.trim() || "there");
}

export function extractHttpUrls(value: string) {
  return [...new Set(value.match(/https?:\/\/[^\s<>]+/g) ?? [])];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textLineToHtml(value: string) {
  const urlPattern = /https?:\/\/[^\s<>]+/g;
  let result = "";
  let cursor = 0;

  for (const match of value.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    const url = match[0];
    result += escapeHtml(value.slice(cursor, index));
    result += `<a href="${escapeHtml(url)}" style="color:#7b2937;text-decoration:underline;text-underline-offset:3px">${escapeHtml(url)}</a>`;
    cursor = index + url.length;
  }

  return result + escapeHtml(value.slice(cursor));
}

function bodyToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 22px;color:#353632;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.72">${paragraph
          .split("\n")
          .map(textLineToHtml)
          .join("<br>")}</p>`,
    )
    .join("");
}

export function renderFrameCampaignEmail(input: {
  content: EmailCampaignContent;
  firstName: string | null;
  unsubscribeUrl: string;
  siteUrl: string;
  postalAddress: string;
  testMode?: boolean;
}) {
  const subject = personalizeEmailCopy(input.content.subject, input.firstName);
  const previewText = personalizeEmailCopy(
    input.content.previewText,
    input.firstName,
  );
  const body = personalizeEmailCopy(input.content.body, input.firstName);
  const ctaLabel = personalizeEmailCopy(
    input.content.ctaLabel,
    input.firstName,
  );
  const safeUnsubscribeUrl = escapeHtml(input.unsubscribeUrl);
  const safeSiteUrl = escapeHtml(input.siteUrl);
  const safePostalAddress = escapeHtml(input.postalAddress);
  const cta = ctaLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0 38px"><tr><td style="background:#20211e"><a href="${escapeHtml(input.content.ctaUrl)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(ctaLabel)}</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ebe6dc;color:#20211e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ebe6dc">
      <tr>
        <td align="center" style="padding:32px 14px">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#faf8f2;border-top:4px solid #7b2937">
            <tr>
              <td style="padding:42px 48px 20px">
                <a href="${safeSiteUrl}" style="color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:31px;letter-spacing:-1px;text-decoration:none">Frame</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 48px 30px">
                ${bodyToHtml(body)}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 48px 36px;border-top:1px solid #ded8cd;color:#777870;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.65">
                ${
                  input.testMode
                    ? "This is a test email sent only to the Frame administrator.<br>"
                    : `You’re receiving this email because you joined Frame early access.<br>
                <a href="${safeUnsubscribeUrl}" style="color:#55564f;text-decoration:underline">Unsubscribe</a>
                &nbsp;·&nbsp;`
                }
                <a href="${safeSiteUrl}/privacy" style="color:#55564f;text-decoration:underline">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${safeSiteUrl}/contact" style="color:#55564f;text-decoration:underline">Contact Frame</a><br>
                ${safePostalAddress}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    body,
    ...(ctaLabel ? ["", `${ctaLabel}: ${input.content.ctaUrl}`] : []),
    "",
    input.testMode
      ? "This is a test email sent only to the Frame administrator."
      : "You’re receiving this email because you joined Frame early access.",
    ...(input.testMode ? [] : [`Unsubscribe: ${input.unsubscribeUrl}`]),
    `Privacy: ${input.siteUrl}/privacy`,
    `Postal address: ${input.postalAddress}`,
  ].join("\n");

  return { subject, html, text };
}
