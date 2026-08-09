import { formatContributorNumber } from "./contributor-membership";
import { getRuntimeValue } from "./runtime-env.server";
import type { RenderedAutomatedEmail } from "./preorder-email-preview-renderers.server";
import {
  renderFrameTransactionalEmail,
  renderTransactionalNotice,
  renderTransactionalSummaryPanel,
} from "./transactional-email-design";
import { SUPPORT_EMAIL } from "./company";

export type ContributorWelcomeEmailInput = {
  origin: string;
  email: string;
  fullName: string;
  contributorNumber: number;
  paidAt: string;
  accessExpiresAt: string;
};

export function renderContributorWelcomeEmail(
  input: ContributorWelcomeEmailInput,
): RenderedAutomatedEmail {
  const number = formatContributorNumber(input.contributorNumber);
  const start = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
    new Date(input.paidAt),
  );
  const end = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
    new Date(input.accessExpiresAt),
  );
  const signInUrl = `${input.origin}/contributors/sign-in`;
  const termsUrl = `${input.origin}/contributors/terms`;
  const refundsUrl = `${input.origin}/contributors/refunds`;
  const subject = "Welcome to the Frame Founding Contributor community";

  return {
    subject,
    text: [
      `Welcome, ${input.fullName}.`,
      "",
      `Your $99 Frame Founding Contributor Membership is active. Your contributor number is ${number}.`,
      `Membership access: ${start} to ${end}.`,
      "",
      "No Frame device has been purchased or reserved. Your payment purchases the membership and benefits described in the terms.",
      "",
      `Activate or sign in to your member hub: ${signInUrl}`,
      `Membership terms: ${termsUrl}`,
      `Refund policy: ${refundsUrl}`,
      "",
      `Support: ${SUPPORT_EMAIL}`,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: `Your Frame Founding Contributor membership is active. Contributor ${number}.`,
      headerLabel: "Membership active",
      headerMarker: "check",
      eyebrow: `Founding Contributor ${number}`,
      heading: "Welcome to the Frame contributor community.",
      intro: `Welcome, ${input.fullName}. Your $99 Frame Founding Contributor Membership is now active.`,
      bodyHtml:
        renderTransactionalSummaryPanel({
          eyebrow: "Membership details",
          title: "12 months of community access",
          rows: [
            { label: "Contributor number", value: number, emphasis: true },
            { label: "Access begins", value: start },
            { label: "Access ends", value: end },
          ],
        }) +
        renderTransactionalNotice({
          title: "Membership only.",
          body: "No Frame device has been purchased or reserved. Your payment purchases the membership and benefits described in the terms.",
        }),
      cta: { label: "Activate your member hub", href: signInUrl },
      footerNote: `This is a transactional email about Founding Contributor membership ${number}.`,
      footerLinks: [
        { label: "Membership terms", href: termsUrl },
        { label: "Refund policy", href: refundsUrl },
        { label: "Privacy", href: `${input.origin}/privacy` },
      ],
    }),
  };
}

export async function sendContributorWelcomeEmail(
  input: ContributorWelcomeEmailInput,
) {
  const apiKey = await getRuntimeValue("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("Contributor welcome email is not configured yet.");
  }

  const from =
    (await getRuntimeValue("CONTRIBUTOR_FROM_EMAIL")) ??
    "Frame Contributors <contributors@framewearable.com>";
  const email = renderContributorWelcomeEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Welcome email failed: ${detail.slice(0, 240)}`);
  }
}
