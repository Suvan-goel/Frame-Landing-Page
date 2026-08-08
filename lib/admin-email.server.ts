import {
  EMAIL_MAX_RECIPIENTS,
  renderFrameCampaignEmail,
  type EmailCampaignContent,
  type EmailCampaignSummary,
  type MailingListRecipient,
} from "./admin-email";
import { getRuntimeValue } from "./runtime-env.server";
import { SITE_URL } from "./site";
import { getSupabaseAdmin } from "./supabase-admin.server";
import {
  categorizeVisibleSignups,
  WAITLIST_SIGNUP_SELECT,
  type WaitlistSignup,
} from "./waitlist-leads";

const SUPABASE_PAGE_SIZE = 1_000;
const RESEND_BATCH_SIZE = 100;
const DATABASE_WRITE_SIZE = 500;

type MailingListRow = WaitlistSignup & {
  email_unsubscribe_token: string;
  email_unsubscribed_at: string | null;
};

type CampaignRow = {
  id: string;
  subject: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function getAllWaitlistRows() {
  const supabase = await getSupabaseAdmin();
  const rows: MailingListRow[] = [];

  for (let start = 0; start < EMAIL_MAX_RECIPIENTS; start += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select(`${WAITLIST_SIGNUP_SELECT},email_unsubscribe_token,email_unsubscribed_at`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + SUPABASE_PAGE_SIZE - 1)
      .returns<MailingListRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

export async function getMailingListAdminData() {
  const [rows, campaignResult] = await Promise.all([
    getAllWaitlistRows(),
    (async () => {
      const supabase = await getSupabaseAdmin();
      return supabase
        .from("email_campaigns")
        .select(
          "id,subject,status,recipient_count,sent_count,failed_count,created_by,created_at,completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<CampaignRow[]>();
    })(),
  ]);

  if (campaignResult.error) throw campaignResult.error;

  const subscribedRows = rows.filter((row) => !row.email_unsubscribed_at);
  const recipients: MailingListRecipient[] = categorizeVisibleSignups(subscribedRows)
    .map(({ signup, qualificationStatus }) => ({
      id: signup.id,
      email: signup.email,
      firstName: signup.first_name,
      lastName: signup.last_name,
      qualificationStatus,
      joinedAt: signup.created_at,
    }));
  const campaigns: EmailCampaignSummary[] = (campaignResult.data ?? []).map(
    (row) => ({
      id: row.id,
      subject: row.subject,
      status: row.status,
      recipientCount: row.recipient_count,
      sentCount: row.sent_count,
      failedCount: row.failed_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }),
  );

  return {
    recipients,
    suppressedCount: rows.length - recipients.length,
    campaigns,
  };
}

async function updateCampaignFailure(campaignId: string, message: string) {
  const supabase = await getSupabaseAdmin();
  await supabase
    .from("email_campaigns")
    .update({
      status: "failed",
      failed_count: 0,
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

export async function sendWaitlistEmailCampaign(input: {
  createdBy: string;
  recipientIds: number[];
  content: EmailCampaignContent;
}) {
  const apiKey = await getRuntimeValue("RESEND_API_KEY");
  if (!apiKey) throw new Error("Email delivery is not configured yet.");

  const from =
    (await getRuntimeValue("MAILING_FROM_EMAIL")) ??
    "Frame Updates <updates@framewearable.com>";
  const replyTo =
    (await getRuntimeValue("MAILING_REPLY_TO_EMAIL")) ??
    "support@framewearable.com";
  const requestedIds = new Set(input.recipientIds);
  const eligibleRows = (await getAllWaitlistRows()).filter(
    (row) => requestedIds.has(row.id) && !row.email_unsubscribed_at,
  );

  if (eligibleRows.length !== requestedIds.size) {
    throw new Error(
      "One or more selected recipients are no longer subscribed. Refresh the page and review the audience.",
    );
  }

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
    const message =
      error instanceof Error ? error.message : "Campaign preparation failed.";
    await updateCampaignFailure(campaignId, message);
    throw error;
  }

  let sentCount = 0;
  let failedCount = 0;
  const failures: string[] = [];
  const recipientBatches = chunks(eligibleRows, RESEND_BATCH_SIZE);

  for (const [batchIndex, recipientBatch] of recipientBatches.entries()) {
    const payload = recipientBatch.map((recipient) => {
      const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(recipient.email_unsubscribe_token)}`;
      const oneClickUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(recipient.email_unsubscribe_token)}`;
      const email = renderFrameCampaignEmail({
        content: input.content,
        firstName: recipient.first_name,
        unsubscribeUrl,
        siteUrl: SITE_URL,
      });

      return {
        from,
        to: [recipient.email],
        reply_to: replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "message_type", value: "waitlist_update" },
          { name: "campaign_id", value: campaignId },
        ],
      };
    });

    let response: Response | null = null;
    let responseMessage = "";
    try {
      response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${campaignId}-${batchIndex}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) responseMessage = (await response.text()).slice(0, 500);
    } catch (error) {
      responseMessage =
        error instanceof Error ? error.message : "Email provider request failed.";
    }

    if (!response?.ok) {
      failedCount += recipientBatch.length;
      failures.push(responseMessage || `Batch ${batchIndex + 1} failed.`);
      const failed = await supabase
        .from("email_campaign_recipients")
        .update({
          status: "failed",
          error_message: (responseMessage || "Email provider request failed.").slice(
            0,
            500,
          ),
        })
        .eq("campaign_id", campaignId)
        .in(
          "waitlist_signup_id",
          recipientBatch.map((recipient) => recipient.id),
        );
      if (failed.error) console.error("Campaign failure audit update failed", failed.error);
      continue;
    }

    const result = (await response.json().catch(() => ({}))) as {
      data?: Array<{ id?: string }>;
    };
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
        error_message: null,
      })),
      { onConflict: "campaign_id,recipient_email" },
    );
    if (delivered.error) {
      console.error("Campaign delivery audit update failed", delivered.error);
    }
    sentCount += recipientBatch.length;
  }

  const completedAt = new Date().toISOString();
  const status = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
  const completed = await supabase
    .from("email_campaigns")
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      error_message: failures.join(" | ").slice(0, 500) || null,
      completed_at: completedAt,
    })
    .eq("id", campaignId);
  if (completed.error) throw completed.error;

  return { campaignId, status, sentCount, failedCount };
}
