import {
  EMAIL_CONFIRMATION_MINUTES,
  EMAIL_MAX_RECIPIENTS,
  renderFrameCampaignEmail,
  type EmailCampaignContent,
  type EmailCampaignDetail,
  type EmailCampaignDraft,
  type EmailCampaignSummary,
  type MailingListRecipient,
} from "./admin-email";
import {
  createResendWebhook,
  getMailingRuntimeConfiguration,
  RESEND_BATCH_SIZE,
  sendResendBatch,
  sendResendEmail,
} from "./resend-mailing.server";
import { SITE_URL } from "./site";
import { getSupabaseAdmin } from "./supabase-admin.server";
import {
  categorizeVisibleSignups,
  WAITLIST_SIGNUP_SELECT,
  type WaitlistSignup,
} from "./waitlist-leads";

const SUPABASE_PAGE_SIZE = 1_000;
const DATABASE_WRITE_SIZE = 500;
const WEBHOOK_SETTINGS_KEY = "resend_webhook";

type MailingListRow = WaitlistSignup & {
  email_unsubscribe_token: string;
  email_unsubscribed_at: string | null;
  email_delivery_suppressed_at: string | null;
  email_delivery_suppression_reason: string | null;
};

type CampaignRow = {
  id: string;
  subject: string;
  preview_text?: string | null;
  body_text?: string;
  cta_label?: string | null;
  cta_url?: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

type CampaignRecipientRow = {
  id: string;
  waitlist_signup_id: number | null;
  recipient_email: string;
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  last_event: string | null;
  last_event_at: string | null;
};

type DraftRow = {
  subject: string;
  preview_text: string;
  body_text: string;
  cta_label: string;
  cta_url: string;
  recipient_ids: number[];
  preview_recipient_id: number | null;
  updated_at: string;
};

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function isMailingEligible(row: MailingListRow) {
  return !row.email_unsubscribed_at && !row.email_delivery_suppressed_at;
}

async function getAllWaitlistRows() {
  const supabase = await getSupabaseAdmin();
  const rows: MailingListRow[] = [];

  for (let start = 0; start <= EMAIL_MAX_RECIPIENTS; start += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select(
        `${WAITLIST_SIGNUP_SELECT},email_unsubscribe_token,email_unsubscribed_at,email_delivery_suppressed_at,email_delivery_suppression_reason`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + SUPABASE_PAGE_SIZE - 1)
      .returns<MailingListRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }

  return {
    rows: rows.slice(0, EMAIL_MAX_RECIPIENTS),
    capacityExceeded: rows.length > EMAIL_MAX_RECIPIENTS,
  };
}

async function getWebhookSetting() {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_provider_settings")
    .select("secret_value,metadata,updated_at")
    .eq("key", WEBHOOK_SETTINGS_KEY)
    .maybeSingle<{ secret_value: string | null; metadata: Record<string, unknown>; updated_at: string }>();
  if (error) throw error;
  return data;
}

function campaignSummary(row: CampaignRow): EmailCampaignSummary {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function getMailingListAdminData(createdBy: string) {
  const normalizedEmail = createdBy.trim().toLowerCase();
  const supabase = await getSupabaseAdmin();
  const [{ rows, capacityExceeded }, campaignResult, draftResult, webhook, runtime] =
    await Promise.all([
      getAllWaitlistRows(),
      supabase
        .from("email_campaigns")
        .select(
          "id,subject,status,recipient_count,sent_count,failed_count,created_by,created_at,completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<CampaignRow[]>(),
      supabase
        .from("email_campaign_drafts")
        .select(
          "subject,preview_text,body_text,cta_label,cta_url,recipient_ids,preview_recipient_id,updated_at",
        )
        .eq("created_by", normalizedEmail)
        .maybeSingle<DraftRow>(),
      getWebhookSetting(),
      getMailingRuntimeConfiguration(),
    ]);

  if (campaignResult.error) throw campaignResult.error;
  if (draftResult.error) throw draftResult.error;

  const eligibleRows = rows.filter(isMailingEligible);
  const recipients: MailingListRecipient[] = categorizeVisibleSignups(eligibleRows).map(
    ({ signup, qualificationStatus }) => ({
      id: signup.id,
      email: signup.email,
      firstName: signup.first_name,
      lastName: signup.last_name,
      qualificationStatus,
      joinedAt: signup.created_at,
    }),
  );
  const draft: EmailCampaignDraft | null = draftResult.data
    ? {
        content: {
          subject: draftResult.data.subject,
          previewText: draftResult.data.preview_text,
          body: draftResult.data.body_text,
          ctaLabel: draftResult.data.cta_label,
          ctaUrl: draftResult.data.cta_url,
        },
        recipientIds: draftResult.data.recipient_ids
          .map(Number)
          .filter((id) => recipients.some((recipient) => recipient.id === id)),
        previewRecipientId: draftResult.data.preview_recipient_id,
        updatedAt: draftResult.data.updated_at,
      }
    : null;

  return {
    recipients,
    unsubscribedCount: rows.filter((row) => Boolean(row.email_unsubscribed_at)).length,
    deliverySuppressedCount: rows.filter((row) => Boolean(row.email_delivery_suppressed_at)).length,
    campaigns: (campaignResult.data ?? []).map(campaignSummary),
    draft,
    capacityExceeded,
    readiness: {
      from: runtime.from,
      replyTo: runtime.replyTo,
      postalAddress: runtime.postalAddress,
      postalAddressConfigured: Boolean(runtime.postalAddress),
      webhookConfigured: Boolean(webhook?.secret_value),
    },
  };
}

export async function saveEmailCampaignDraft(input: {
  createdBy: string;
  content: EmailCampaignContent;
  recipientIds: number[];
  previewRecipientId: number | null;
}) {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("email_campaign_drafts").upsert(
    {
      created_by: input.createdBy.trim().toLowerCase(),
      subject: input.content.subject.slice(0, 160),
      preview_text: input.content.previewText.slice(0, 200),
      body_text: input.content.body.slice(0, 20_000),
      cta_label: input.content.ctaLabel.slice(0, 80),
      cta_url: input.content.ctaUrl.slice(0, 2_000),
      recipient_ids: [...new Set(input.recipientIds)].slice(0, EMAIL_MAX_RECIPIENTS),
      preview_recipient_id: input.previewRecipientId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "created_by" },
  );
  if (error) throw error;
  return { savedAt: new Date().toISOString() };
}

export async function deleteEmailCampaignDraft(createdBy: string) {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("email_campaign_drafts")
    .delete()
    .eq("created_by", createdBy.trim().toLowerCase());
  if (error) throw error;
}

async function payloadHash(input: {
  content: EmailCampaignContent;
  recipientIds: number[];
}) {
  const value = JSON.stringify({
    content: input.content,
    recipientIds: [...new Set(input.recipientIds)].sort((a, b) => a - b),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function eligibleRowsForIds(recipientIds: number[]) {
  const requestedIds = new Set(recipientIds);
  const { rows, capacityExceeded } = await getAllWaitlistRows();
  if (capacityExceeded) {
    throw new Error("The mailing list is above the current safe sending capacity.");
  }
  const eligibleRows = rows.filter(
    (row) => requestedIds.has(row.id) && isMailingEligible(row),
  );
  if (eligibleRows.length !== requestedIds.size) {
    throw new Error(
      "One or more selected recipients are no longer eligible. Refresh the page and review the audience.",
    );
  }
  return eligibleRows;
}

export async function createEmailSendConfirmation(input: {
  createdBy: string;
  recipientIds: number[];
  content: EmailCampaignContent;
}) {
  await requireLiveMailingReady();
  await eligibleRowsForIds(input.recipientIds);
  const supabase = await getSupabaseAdmin();
  const expiresAt = new Date(
    Date.now() + EMAIL_CONFIRMATION_MINUTES * 60 * 1_000,
  ).toISOString();
  const hash = await payloadHash(input);
  const { data, error } = await supabase
    .from("email_send_confirmations")
    .insert({
      created_by: input.createdBy.trim().toLowerCase(),
      payload_hash: hash,
      recipient_count: input.recipientIds.length,
      expires_at: expiresAt,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw error ?? new Error("The campaign review could not be created.");
  return {
    confirmationId: data.id,
    confirmationText: `SEND ${input.recipientIds.length}`,
    expiresAt,
  };
}

async function consumeEmailSendConfirmation(input: {
  confirmationId: string;
  confirmationText: string;
  createdBy: string;
  recipientIds: number[];
  content: EmailCampaignContent;
}) {
  const expectedText = `SEND ${input.recipientIds.length}`;
  if (input.confirmationText.trim() !== expectedText) {
    throw new Error(`Type ${expectedText} exactly to confirm this campaign.`);
  }
  const supabase = await getSupabaseAdmin();
  const hash = await payloadHash(input);
  const { data, error } = await supabase
    .from("email_send_confirmations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", input.confirmationId)
    .eq("created_by", input.createdBy.trim().toLowerCase())
    .eq("payload_hash", hash)
    .eq("recipient_count", input.recipientIds.length)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) {
    throw new Error("This campaign review expired or was already used. Review it again.");
  }
}

async function requireLiveMailingReady() {
  const runtime = await getMailingRuntimeConfiguration();
  if (!runtime.apiKey) throw new Error("Email delivery is not configured yet.");
  if (!runtime.postalAddress) {
    throw new Error("Add Frame’s valid postal address before sending a live campaign.");
  }
  const webhook = await getWebhookSetting();
  if (!webhook?.secret_value) {
    throw new Error("Enable bounce and complaint protection before sending a live campaign.");
  }
  return runtime;
}

function buildRecipientEmail(input: {
  recipient: MailingListRow;
  content: EmailCampaignContent;
  campaignId: string;
  from: string;
  replyTo: string;
  postalAddress: string;
}) {
  const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(input.recipient.email_unsubscribe_token)}`;
  const oneClickUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(input.recipient.email_unsubscribe_token)}`;
  const email = renderFrameCampaignEmail({
    content: input.content,
    firstName: input.recipient.first_name,
    unsubscribeUrl,
    siteUrl: SITE_URL,
    postalAddress: input.postalAddress,
  });
  return {
    from: input.from,
    to: [input.recipient.email],
    reply_to: input.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "message_type", value: "waitlist_update" },
      { name: "campaign_id", value: input.campaignId },
    ],
  };
}

async function updateCampaignFailure(campaignId: string, message: string) {
  const supabase = await getSupabaseAdmin();
  await supabase
    .from("email_campaigns")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

export async function sendTestEmail(input: {
  createdBy: string;
  content: EmailCampaignContent;
}) {
  const runtime = await getMailingRuntimeConfiguration();
  if (!runtime.apiKey) throw new Error("Email delivery is not configured yet.");
  const postalAddress = runtime.postalAddress || "Postal address not configured — test email only";
  const email = renderFrameCampaignEmail({
    content: input.content,
    firstName: "there",
    unsubscribeUrl: "",
    siteUrl: SITE_URL,
    postalAddress,
    testMode: true,
  });
  const idempotencyKey = `waitlist-test-${crypto.randomUUID()}`;
  const result = await sendResendEmail(
    {
      from: runtime.from,
      to: [input.createdBy],
      reply_to: runtime.replyTo,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
      tags: [{ name: "message_type", value: "waitlist_test" }],
    },
    idempotencyKey,
  );
  return { messageId: result.id ?? null, sentTo: input.createdBy };
}

export async function sendWaitlistEmailCampaign(input: {
  createdBy: string;
  recipientIds: number[];
  content: EmailCampaignContent;
  confirmationId: string;
  confirmationText: string;
}) {
  const runtime = await requireLiveMailingReady();
  await consumeEmailSendConfirmation(input);
  const eligibleRows = await eligibleRowsForIds(input.recipientIds);
  const supabase = await getSupabaseAdmin();
  const campaignInsert = await supabase
    .from("email_campaigns")
    .insert({
      created_by: input.createdBy.toLowerCase(),
      subject: input.content.subject,
      preview_text: input.content.previewText || null,
      body_text: input.content.body,
      cta_label: input.content.ctaLabel || null,
      cta_url: input.content.ctaUrl || null,
      status: "preparing",
      recipient_count: eligibleRows.length,
      sent_count: 0,
      failed_count: 0,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignInsert.error || !campaignInsert.data) {
    throw campaignInsert.error ?? new Error("The email campaign could not be created.");
  }
  const campaignId = campaignInsert.data.id;

  try {
    for (const recipientChunk of chunks(eligibleRows, DATABASE_WRITE_SIZE)) {
      const inserted = await supabase.from("email_campaign_recipients").insert(
        recipientChunk.map((recipient) => ({
          campaign_id: campaignId,
          waitlist_signup_id: recipient.id,
          recipient_email: recipient.email,
          recipient_first_name: recipient.first_name,
          recipient_last_name: recipient.last_name,
          status: "pending",
        })),
      );
      if (inserted.error) throw inserted.error;
    }
    const sending = await supabase
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);
    if (sending.error) throw sending.error;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign preparation failed.";
    await updateCampaignFailure(campaignId, message);
    throw error;
  }

  let sentCount = 0;
  let failedCount = 0;
  const failures: string[] = [];
  for (const [batchIndex, recipientBatch] of chunks(eligibleRows, RESEND_BATCH_SIZE).entries()) {
    try {
      const result = await sendResendBatch(
        recipientBatch.map((recipient) =>
          buildRecipientEmail({
            recipient,
            content: input.content,
            campaignId,
            from: runtime.from,
            replyTo: runtime.replyTo,
            postalAddress: runtime.postalAddress,
          }),
        ),
        `${campaignId}-${batchIndex}`,
      );
      const sentAt = new Date().toISOString();
      const delivered = await supabase.from("email_campaign_recipients").upsert(
        recipientBatch.map((recipient, recipientIndex) => ({
          campaign_id: campaignId,
          waitlist_signup_id: recipient.id,
          recipient_email: recipient.email,
          recipient_first_name: recipient.first_name,
          recipient_last_name: recipient.last_name,
          status: "sent",
          provider_message_id: result.data?.[recipientIndex]?.id ?? null,
          sent_at: sentAt,
          last_event: "email.sent",
          last_event_at: sentAt,
          error_message: null,
        })),
        { onConflict: "campaign_id,recipient_email" },
      );
      if (delivered.error) console.error("Campaign delivery audit update failed", delivered.error);
      sentCount += recipientBatch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email provider request failed.";
      failedCount += recipientBatch.length;
      failures.push(message);
      const failed = await supabase
        .from("email_campaign_recipients")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("campaign_id", campaignId)
        .in("waitlist_signup_id", recipientBatch.map((recipient) => recipient.id));
      if (failed.error) console.error("Campaign failure audit update failed", failed.error);
    }
  }

  const status = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
  const completed = await supabase
    .from("email_campaigns")
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      error_message: failures.join(" | ").slice(0, 500) || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (completed.error) throw completed.error;
  await deleteEmailCampaignDraft(input.createdBy);
  return { campaignId, status, sentCount, failedCount };
}

export async function getEmailCampaignDetail(campaignId: string): Promise<EmailCampaignDetail> {
  const supabase = await getSupabaseAdmin();
  const [campaignResult, recipientsResult] = await Promise.all([
    supabase
      .from("email_campaigns")
      .select(
        "id,subject,preview_text,body_text,cta_label,cta_url,status,recipient_count,sent_count,failed_count,created_by,created_at,completed_at",
      )
      .eq("id", campaignId)
      .single<CampaignRow>(),
    supabase
      .from("email_campaign_recipients")
      .select(
        "id,waitlist_signup_id,recipient_email,recipient_first_name,recipient_last_name,status,provider_message_id,error_message,sent_at,last_event,last_event_at",
      )
      .eq("campaign_id", campaignId)
      .order("recipient_email", { ascending: true })
      .returns<CampaignRecipientRow[]>(),
  ]);
  if (campaignResult.error || !campaignResult.data) {
    throw campaignResult.error ?? new Error("Campaign not found.");
  }
  if (recipientsResult.error) throw recipientsResult.error;
  const campaign = campaignResult.data;
  return {
    ...campaignSummary(campaign),
    previewText: campaign.preview_text ?? "",
    body: campaign.body_text ?? "",
    ctaLabel: campaign.cta_label ?? "",
    ctaUrl: campaign.cta_url ?? "",
    recipients: (recipientsResult.data ?? []).map((recipient) => ({
      id: recipient.id,
      email: recipient.recipient_email,
      name:
        [recipient.recipient_first_name, recipient.recipient_last_name]
          .filter(Boolean)
          .join(" ") || "Name not provided",
      status: recipient.status,
      errorMessage: recipient.error_message,
      sentAt: recipient.sent_at,
      lastEvent: recipient.last_event,
      lastEventAt: recipient.last_event_at,
    })),
  };
}

export async function retryFailedEmailCampaign(input: {
  campaignId: string;
  createdBy: string;
  confirmationText: string;
}) {
  const runtime = await requireLiveMailingReady();
  const detail = await getEmailCampaignDetail(input.campaignId);
  const failed = detail.recipients.filter((recipient) => recipient.status === "failed");
  const expected = `RETRY ${failed.length}`;
  if (!failed.length) throw new Error("This campaign has no failed recipients to retry.");
  if (input.confirmationText.trim() !== expected) {
    throw new Error(`Type ${expected} exactly to retry these recipients.`);
  }

  const requestedIds = failed
    .map((recipient) => {
      const row = detail.recipients.find((candidate) => candidate.id === recipient.id);
      return row?.id;
    })
    .filter(Boolean);
  const supabase = await getSupabaseAdmin();
  const failedRowsResult = await supabase
    .from("email_campaign_recipients")
    .select(
      "id,waitlist_signup_id,recipient_email,recipient_first_name,recipient_last_name,status,provider_message_id,error_message,sent_at,last_event,last_event_at",
    )
    .eq("campaign_id", input.campaignId)
    .eq("status", "failed")
    .in("id", requestedIds)
    .returns<CampaignRecipientRow[]>();
  if (failedRowsResult.error) throw failedRowsResult.error;
  const waitlistIds = (failedRowsResult.data ?? [])
    .map((row) => row.waitlist_signup_id)
    .filter((id): id is number => typeof id === "number");
  const eligibleRows = await eligibleRowsForIds(waitlistIds);
  const eligibleById = new Map(eligibleRows.map((row) => [row.id, row]));
  const claimed = await supabase
    .from("email_campaign_recipients")
    .update({ status: "retrying", error_message: null })
    .eq("campaign_id", input.campaignId)
    .eq("status", "failed")
    .in("waitlist_signup_id", waitlistIds)
    .select("id,waitlist_signup_id")
    .returns<Array<{ id: string; waitlist_signup_id: number }>>();
  if (claimed.error) throw claimed.error;
  if (!claimed.data?.length) throw new Error("Those failures were already retried.");

  const attemptId = crypto.randomUUID();
  let sentCount = 0;
  let failedCount = 0;
  for (const [batchIndex, batch] of chunks(claimed.data, RESEND_BATCH_SIZE).entries()) {
    const recipients = batch
      .map((item) => eligibleById.get(item.waitlist_signup_id))
      .filter((row): row is MailingListRow => Boolean(row));
    try {
      const result = await sendResendBatch(
        recipients.map((recipient) =>
          buildRecipientEmail({
            recipient,
            content: {
              subject: detail.subject,
              previewText: detail.previewText,
              body: detail.body,
              ctaLabel: detail.ctaLabel,
              ctaUrl: detail.ctaUrl,
            },
            campaignId: input.campaignId,
            from: runtime.from,
            replyTo: runtime.replyTo,
            postalAddress: runtime.postalAddress,
          }),
        ),
        `${input.campaignId}-retry-${attemptId}-${batchIndex}`,
      );
      const sentAt = new Date().toISOString();
      for (const [index, recipient] of recipients.entries()) {
        await supabase
          .from("email_campaign_recipients")
          .update({
            status: "sent",
            provider_message_id: result.data?.[index]?.id ?? null,
            sent_at: sentAt,
            last_event: "email.sent",
            last_event_at: sentAt,
          })
          .eq("campaign_id", input.campaignId)
          .eq("waitlist_signup_id", recipient.id);
      }
      sentCount += recipients.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed.";
      await supabase
        .from("email_campaign_recipients")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("campaign_id", input.campaignId)
        .in("waitlist_signup_id", recipients.map((recipient) => recipient.id));
      failedCount += recipients.length;
    }
  }

  const newSentCount = detail.sentCount + sentCount;
  const newFailedCount = Math.max(0, detail.failedCount - sentCount);
  const status = newFailedCount === 0 ? "sent" : newSentCount === 0 ? "failed" : "partial";
  await supabase
    .from("email_campaigns")
    .update({ status, sent_count: newSentCount, failed_count: newFailedCount })
    .eq("id", input.campaignId);
  return { sentCount, failedCount, status };
}

export async function enableResendWebhookProtection() {
  const existing = await getWebhookSetting();
  if (existing?.secret_value) return { configured: true, created: false };
  const webhook = await createResendWebhook();
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("email_provider_settings").upsert(
    {
      key: WEBHOOK_SETTINGS_KEY,
      secret_value: webhook.signing_secret,
      metadata: { provider: "resend", webhookId: webhook.id },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw error;
  return { configured: true, created: true };
}

export async function getResendWebhookSecret() {
  return (await getWebhookSetting())?.secret_value ?? null;
}

export async function processResendWebhookEvent(input: {
  eventId: string;
  event: {
    type: string;
    created_at?: string;
    data?: { email_id?: string; to?: string[] };
  };
}) {
  const supabase = await getSupabaseAdmin();
  const emailId = input.event.data?.email_id ?? null;
  const inserted = await supabase.from("email_webhook_events").insert({
    event_id: input.eventId,
    event_type: input.event.type,
    provider_message_id: emailId,
    payload: input.event,
  });
  if (inserted.error) {
    if (inserted.error.code === "23505") return { duplicate: true };
    throw inserted.error;
  }
  if (!emailId) return { duplicate: false };

  try {
    const recipientResult = await supabase
      .from("email_campaign_recipients")
      .select("campaign_id")
      .eq("provider_message_id", emailId)
      .maybeSingle<{ campaign_id: string }>();
    if (recipientResult.error) throw recipientResult.error;

    const statusByEvent: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.failed": "failed",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.suppressed": "bounced",
    };
    const status = statusByEvent[input.event.type];
    const eventAt = input.event.created_at ?? new Date().toISOString();
    const recipientUpdate = await supabase
      .from("email_campaign_recipients")
      .update(
        status
          ? { status, last_event: input.event.type, last_event_at: eventAt }
          : { last_event: input.event.type, last_event_at: eventAt },
      )
      .eq("provider_message_id", emailId);
    if (recipientUpdate.error) throw recipientUpdate.error;

    if (["email.bounced", "email.complained", "email.suppressed"].includes(input.event.type)) {
      const addresses = (input.event.data?.to ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (addresses.length) {
        const suppressed = await supabase
          .from("waitlist_signups")
          .update({
            email_delivery_suppressed_at: eventAt,
            email_delivery_suppression_reason: input.event.type,
            email_delivery_suppression_provider_id: emailId,
          })
          .in("email", addresses);
        if (suppressed.error) throw suppressed.error;
      }
    }

    if (recipientResult.data?.campaign_id && status) {
      const statuses = await supabase
        .from("email_campaign_recipients")
        .select("status")
        .eq("campaign_id", recipientResult.data.campaign_id)
        .returns<Array<{ status: string }>>();
      if (statuses.error) throw statuses.error;
      const sentCount = (statuses.data ?? []).filter((row) =>
        ["sent", "delivered"].includes(row.status),
      ).length;
      const failedCount = (statuses.data ?? []).filter((row) =>
        ["failed", "bounced", "complained"].includes(row.status),
      ).length;
      const campaignStatus =
        failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
      const campaignUpdate = await supabase
        .from("email_campaigns")
        .update({ status: campaignStatus, sent_count: sentCount, failed_count: failedCount })
        .eq("id", recipientResult.data.campaign_id);
      if (campaignUpdate.error) throw campaignUpdate.error;
    }
    return { duplicate: false };
  } catch (error) {
    await supabase.from("email_webhook_events").delete().eq("event_id", input.eventId);
    throw error;
  }
}
