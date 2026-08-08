import { formatContributorNumber } from "./contributor-membership";
import { getRuntimeValue } from "./runtime-env.server";
import type { RenderedAutomatedEmail } from "./preorder-email-preview-renderers.server";

export type ContributorWelcomeEmailInput = {
  origin: string;
  email: string;
  fullName: string;
  contributorNumber: number;
  paidAt: string;
  accessExpiresAt: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderContributorWelcomeEmail(
  input: ContributorWelcomeEmailInput,
): RenderedAutomatedEmail {
  const name = escapeHtml(input.fullName);
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

  return {
    subject: "Welcome to the Frame Founding Contributor community",
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
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">Founding Contributor ${number}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Welcome to the Frame contributor community.</h1>
        <p>Welcome, ${name}. Your <strong>$99 Frame Founding Contributor Membership</strong> is now active.</p>
        <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
          <p style="margin:0 0 8px"><strong>Contributor number:</strong> ${number}</p>
          <p style="margin:0"><strong>Community access:</strong> ${start} to ${end}</p>
        </div>
        <p><strong>No Frame device has been purchased or reserved.</strong> Your payment purchases the 12-month membership and the benefits described in the membership terms.</p>
        <p style="margin:32px 0"><a href="${signInUrl}" style="background:#20211e;color:#fff;padding:14px 22px;text-decoration:none">Activate your member hub</a></p>
        <p><a href="${termsUrl}">Membership terms</a> · <a href="${refundsUrl}">Refund policy</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
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
