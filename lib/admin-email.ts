import { ORGANIZATION_DISPLAY_NAME } from "./company.ts";

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
    result += `<a href="${escapeHtml(url)}" style="color:#7b2937;text-decoration:underline">${escapeHtml(url)}</a>`;
    cursor = index + url.length;
  }

  return result + escapeHtml(value.slice(cursor));
}

function bodyToHtml(value: string) {
  const paragraphs = value.split(/\n{2,}/);
  return paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:0 0 ${index === paragraphs.length - 1 ? "0" : "24px"};color:#3f403c;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75">${paragraph
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
  const inboxPreview = previewText || "A new update from Frame.";
  const safeUnsubscribeUrl = escapeHtml(input.unsubscribeUrl);
  const safeSiteUrl = escapeHtml(input.siteUrl);
  const safePostalAddress = escapeHtml(input.postalAddress);
  const year = new Date().getFullYear();
  const cta = ctaLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:34px 0 0"><tr><td bgcolor="#963f49" style="background:#963f49;border-radius:2px"><a class="email-cta-link" href="${escapeHtml(input.content.ctaUrl)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.01em;line-height:1.4;text-decoration:none">${escapeHtml(ctaLabel)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    : "";
  const footerLinks = input.testMode
    ? `<a href="${safeSiteUrl}" style="color:#5f605b;text-decoration:underline">framewearable.com</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/contact" style="color:#5f605b;text-decoration:underline">Contact</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/privacy" style="color:#5f605b;text-decoration:underline">Privacy</a>`
    : `<a href="${safeSiteUrl}" style="color:#5f605b;text-decoration:underline">framewearable.com</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/contact" style="color:#5f605b;text-decoration:underline">Contact</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/privacy" style="color:#5f605b;text-decoration:underline">Privacy</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeUnsubscribeUrl}" style="color:#5f605b;text-decoration:underline">Unsubscribe</a>`;
  const footerReason = input.testMode
    ? "This is a test email sent only to the Frame administrator."
    : "You’re receiving this because you signed up for Frame updates.";
  const postalAddress = safePostalAddress
    ? `<p style="margin:5px 0 0">${safePostalAddress}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(subject)}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      table { border-collapse: collapse !important; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
      @media only screen and (max-width: 620px) {
        .email-outer { padding: 12px 0 20px !important; }
        .email-card { width: 100% !important; border-left: 0 !important; border-right: 0 !important; }
        .email-header { padding: 24px !important; }
        .email-content { padding: 38px 24px 44px !important; }
        .email-footer { padding: 24px !important; }
        .email-heading { font-size: 30px !important; line-height: 1.14 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f2efe9;color:#20211e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px">${escapeHtml(inboxPreview)}&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2efe9" style="width:100%;background:#f2efe9">
      <tr>
        <td class="email-outer" align="center" style="padding:40px 16px 28px">
          <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ddd9d1">
            <tr>
              <td height="4" bgcolor="#963f49" style="height:4px;background:#963f49;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-header" style="padding:28px 44px 24px;border-bottom:1px solid #ebe7df">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      <a href="${safeSiteUrl}" style="color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:400;letter-spacing:-.8px;line-height:1;text-decoration:none">Frame<span style="color:#963f49">.</span></a>
                    </td>
                    <td class="email-header-note" align="right" valign="middle">
                      <span style="color:#77746d;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">Update</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:48px 44px 54px">
                <p style="margin:0 0 14px;color:#963f49;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.17em;line-height:1.4;text-transform:uppercase">A note from us</p>
                <h1 class="email-heading" style="margin:0;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:35px;font-weight:400;letter-spacing:-.7px;line-height:1.15">${escapeHtml(subject)}</h1>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 29px"><tr><td width="42" height="2" bgcolor="#963f49" style="width:42px;height:2px;background:#963f49;font-size:0;line-height:0">&nbsp;</td></tr></table>
                ${bodyToHtml(body)}
                ${cta}
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#f7f4ee" style="padding:25px 44px 27px;border-top:1px solid #ebe7df;background:#f7f4ee;color:#77766f;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.65;text-align:left">
                <p style="margin:0 0 9px;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1">Frame<span style="color:#963f49">.</span></p>
                <p style="margin:0 0 8px">${footerLinks}</p>
                <p style="margin:0">${footerReason} &copy; ${year} ${escapeHtml(ORGANIZATION_DISPLAY_NAME)}.</p>
                ${postalAddress}
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
      : "You’re receiving this email because you signed up for Frame updates.",
    ...(input.testMode ? [] : [`Unsubscribe: ${input.unsubscribeUrl}`]),
    `Privacy: ${input.siteUrl}/privacy`,
    `Contact: ${input.siteUrl}/contact`,
    ...(input.postalAddress ? [`Postal address: ${input.postalAddress}`] : []),
  ].join("\n");

  return { subject, html, text };
}
