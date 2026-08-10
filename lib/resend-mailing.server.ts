import { getRuntimeValue } from "./runtime-env.server";
import { COMPANY_DETAILS_COMPLETE, formatCorrespondenceAddress } from "./company";

export const RESEND_BATCH_SIZE = 100;
export const UPDATES_EMAIL = "updates@framewearable.com";

export type ResendEmailPayload = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export async function getMailingRuntimeConfiguration() {
  const apiKey = (await getRuntimeValue("RESEND_API_KEY"))?.trim() ?? "";
  const from =
    (await getRuntimeValue("MAILING_FROM_EMAIL"))?.trim() ||
    `Frame Updates <${UPDATES_EMAIL}>`;
  const replyTo =
    (await getRuntimeValue("MAILING_REPLY_TO_EMAIL"))?.trim() ||
    UPDATES_EMAIL;
  const postalAddress =
    (await getRuntimeValue("MAILING_POSTAL_ADDRESS"))?.trim() ||
    (COMPANY_DETAILS_COMPLETE ? formatCorrespondenceAddress() : "");

  return { apiKey, from, replyTo, postalAddress };
}

export async function sendResendBatch(
  payload: ResendEmailPayload[],
  idempotencyKey: string,
) {
  const { apiKey } = await getMailingRuntimeConfiguration();
  if (!apiKey) throw new Error("Email delivery is not configured yet.");

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Email provider request failed.",
    );
  }

  if (!response.ok) {
    throw new Error((await response.text()).slice(0, 500) || "Email provider request failed.");
  }

  return (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string }>;
  };
}

export async function sendResendEmail(
  payload: ResendEmailPayload,
  idempotencyKey: string,
) {
  const { apiKey } = await getMailingRuntimeConfiguration();
  if (!apiKey) throw new Error("Email delivery is not configured yet.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error((await response.text()).slice(0, 500) || "Test email could not be sent.");
  }
  return (await response.json().catch(() => ({}))) as { id?: string };
}
