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
  const heroSummary = previewText
    ? `<p class="email-summary" style="max-width:440px;margin:18px 0 0;color:#cccac3;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">${escapeHtml(previewText)}</p>`
    : "";
  const cta = ctaLabel
    ? `<table class="email-cta-table" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:34px 0 0"><tr><td bgcolor="#8d3e46" style="background:#8d3e46;border-radius:3px"><a class="email-cta-button" href="${escapeHtml(input.content.ctaUrl)}" style="display:inline-block;padding:14px 21px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.02em;line-height:1.2;text-decoration:none">${escapeHtml(ctaLabel)}&nbsp;&nbsp;<span aria-hidden="true">&rarr;</span></a></td></tr></table>`
    : "";
  const footerLinks = input.testMode
    ? `<a href="${safeSiteUrl}" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">framewearable.com</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/contact" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">Contact</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/privacy" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">Privacy</a>`
    : `<a href="${safeSiteUrl}" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">framewearable.com</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/contact" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">Contact</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeSiteUrl}/privacy" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">Privacy</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${safeUnsubscribeUrl}" style="color:#5f605b;text-decoration:underline;text-underline-offset:2px">Unsubscribe</a>`;
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
        .email-card { width: 100% !important; border-left: 0 !important; border-right: 0 !important; border-radius: 0 !important; }
        .email-header { padding: 24px !important; }
        .email-site-link { display: none !important; }
        .email-hero { padding: 38px 24px 41px !important; }
        .email-content { padding: 37px 24px 42px !important; }
        .email-footer { padding: 27px 24px 31px !important; }
        .email-heading { font-size: 31px !important; line-height: 1.16 !important; }
        .email-summary { font-size: 14px !important; }
        .email-cta-table { width: 100% !important; }
        .email-cta-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#ebe8e1;color:#20211e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px">${escapeHtml(inboxPreview)}&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ebe8e1" style="width:100%;background:#ebe8e1">
      <tr>
        <td class="email-outer" align="center" style="padding:42px 16px 32px">
          <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #d9d6ce;border-radius:12px;box-shadow:0 18px 48px rgba(32,33,30,.08);overflow:hidden">
            <tr>
              <td height="6" bgcolor="#8d3e46" style="height:6px;background:#8d3e46;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-header" bgcolor="#ffffff" style="padding:30px 44px 29px;background:#ffffff">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      <a href="${safeSiteUrl}" style="color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;letter-spacing:-.8px;line-height:1;text-decoration:none">Frame</a>
                    </td>
                    <td class="email-site-link" align="right" valign="middle">
                      <a href="${safeSiteUrl}" style="color:#73746e;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:.08em;line-height:1;text-decoration:none;text-transform:uppercase">framewearable.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-hero" bgcolor="#20211e" style="padding:47px 44px 50px;background:#20211e">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr><td width="44" height="3" bgcolor="#a54a56" style="width:44px;height:3px;background:#a54a56;font-size:0;line-height:0">&nbsp;</td></tr></table>
                <h1 class="email-heading" style="max-width:470px;margin:0;color:#f7f4ed;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:400;letter-spacing:-.8px;line-height:1.16">${escapeHtml(subject)}</h1>
                ${heroSummary}
              </td>
            </tr>
            <tr>
              <td class="email-content" bgcolor="#ffffff" style="padding:45px 44px 50px;background:#ffffff">
                ${bodyToHtml(body)}
                ${cta}
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#f6f3ed" style="padding:29px 44px 34px;border-top:1px solid #e2ded5;background:#f6f3ed;color:#777872;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.7;text-align:left">
                <p style="margin:0 0 12px;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:700;letter-spacing:-.3px;line-height:1">Frame</p>
                <p style="margin:0 0 13px">${footerLinks}</p>
                <p style="margin:0;color:#85867f">${footerReason}<br>&copy; ${year} Frame Health Technologies.</p>
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
