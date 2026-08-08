"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMAIL_BODY_MAX_LENGTH,
  EMAIL_CTA_LABEL_MAX_LENGTH,
  EMAIL_PREVIEW_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
  RESEND_WEBHOOK_ENDPOINT,
  RESEND_WEBHOOK_EVENTS,
  extractHttpUrls,
  renderFrameCampaignEmail,
  validateEmailCampaignContent,
  type EmailCampaignContent,
  type EmailCampaignDetail,
  type EmailCampaignDraft,
  type EmailCampaignSummary,
  type EmailDeliveryReadiness,
  type MailingListRecipient,
} from "@/lib/admin-email";

type AudienceFilter = "all" | "qualified" | "incomplete";
type RequestStatus = "idle" | "working" | "success" | "error";

const EMPTY_CONTENT: EmailCampaignContent = {
  subject: "",
  previewText: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
};

function recipientName(recipient: MailingListRecipient) {
  return [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || "Name not provided";
}

function campaignStatusLabel(status: string) {
  if (status === "partial") return "Partially sent";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "sending") return "Sending";
  return "Preparing";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

export function AdminEmailComposer({
  recipients,
  unsubscribedCount,
  deliverySuppressedCount,
  campaigns,
  initialDraft,
  readiness,
  capacityExceeded,
  ownerEmail,
}: {
  recipients: MailingListRecipient[];
  unsubscribedCount: number;
  deliverySuppressedCount: number;
  campaigns: EmailCampaignSummary[];
  initialDraft: EmailCampaignDraft | null;
  readiness: EmailDeliveryReadiness;
  capacityExceeded: boolean;
  ownerEmail: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialDraft?.content ?? EMPTY_CONTENT);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(initialDraft?.recipientIds ?? []),
  );
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [search, setSearch] = useState("");
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewRecipientId, setPreviewRecipientId] = useState(
    initialDraft?.previewRecipientId ?? recipients[0]?.id ?? 0,
  );
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">(
    initialDraft ? "saved" : "idle",
  );
  const [draftMessage, setDraftMessage] = useState(
    initialDraft ? `Restored draft saved ${formatDateTime(initialDraft.updatedAt)} UTC` : "",
  );
  const [testStatus, setTestStatus] = useState<RequestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [sendStatus, setSendStatus] = useState<RequestStatus>("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [review, setReview] = useState<{
    confirmationId: string;
    confirmationText: string;
    expiresAt: string;
  } | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(readiness.webhookConfigured);
  const [webhookVerified, setWebhookVerified] = useState(readiness.webhookVerified);
  const [webhookSetupOpen, setWebhookSetupOpen] = useState(
    readiness.webhookConfigured && !readiness.webhookVerified,
  );
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<RequestStatus>("idle");
  const [webhookMessage, setWebhookMessage] = useState("");
  const [campaignDetail, setCampaignDetail] = useState<EmailCampaignDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<RequestStatus>("idle");
  const [detailMessage, setDetailMessage] = useState("");
  const [retryInput, setRetryInput] = useState("");
  const [retryStatus, setRetryStatus] = useState<RequestStatus>("idle");

  const qualifiedCount = useMemo(
    () => recipients.filter((recipient) => recipient.qualificationStatus === "completed").length,
    [recipients],
  );
  const visibleRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipients.filter((recipient) => {
      if (audienceFilter === "qualified" && recipient.qualificationStatus !== "completed") return false;
      if (audienceFilter === "incomplete" && recipient.qualificationStatus === "completed") return false;
      if (!query) return true;
      return `${recipientName(recipient)} ${recipient.email}`.toLowerCase().includes(query);
    });
  }, [audienceFilter, recipients, search]);
  const previewOptions = useMemo(() => {
    const query = previewSearch.trim().toLowerCase();
    if (!query) return recipients;
    const filtered = recipients.filter((recipient) =>
      `${recipientName(recipient)} ${recipient.email}`.toLowerCase().includes(query),
    );
    const current = recipients.find((recipient) => recipient.id === previewRecipientId);
    return current && !filtered.some((recipient) => recipient.id === current.id)
      ? [current, ...filtered]
      : filtered;
  }, [previewRecipientId, previewSearch, recipients]);
  const allVisibleSelected =
    visibleRecipients.length > 0 &&
    visibleRecipients.every((recipient) => selectedIds.has(recipient.id));
  const previewRecipient =
    recipients.find((recipient) => recipient.id === previewRecipientId) ?? recipients[0] ?? null;
  const previewContent: EmailCampaignContent = {
    subject: content.subject || "Your subject line will appear here",
    previewText: content.previewText,
    body: content.body || "Start writing your Frame update to see it here.",
    ctaLabel: content.ctaLabel && content.ctaUrl ? content.ctaLabel : "",
    ctaUrl: content.ctaLabel && content.ctaUrl ? content.ctaUrl : "",
  };
  const preview = renderFrameCampaignEmail({
    content: previewContent,
    firstName: previewRecipient?.firstName ?? null,
    unsubscribeUrl: "https://framewearable.com/unsubscribe?token=preview",
    siteUrl: "https://framewearable.com",
    postalAddress: readiness.postalAddress || "Postal address required before live sending",
  });
  const draftHasContent =
    Object.values(content).some((value) => value.trim()) || selectedIds.size > 0;
  const selectedRecipients = recipients.filter((recipient) => selectedIds.has(recipient.id));
  const selectedQualifiedCount = selectedRecipients.filter(
    (recipient) => recipient.qualificationStatus === "completed",
  ).length;
  const liveBlockingReasons = [
    !readiness.postalAddressConfigured ? "Add Frame’s valid postal address" : "",
    !webhookVerified ? "Verify bounce and complaint protection" : "",
    capacityExceeded ? "The list exceeds the current 5,000-recipient safety limit" : "",
  ].filter(Boolean);
  const emailLinks = useMemo(() => {
    const values = [
      ...extractHttpUrls(content.body),
      ...(content.ctaUrl ? [content.ctaUrl] : []),
    ];
    return [...new Set(values)];
  }, [content.body, content.ctaUrl]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!draftHasContent) {
        await fetch("/api/admin/email/draft", { method: "DELETE" }).catch(() => undefined);
        setDraftStatus("idle");
        setDraftMessage("");
        return;
      }
      setDraftStatus("saving");
      setDraftMessage("Saving draft…");
      try {
        const response = await fetch("/api/admin/email/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            recipientIds: [...selectedIds],
            previewRecipientId,
          }),
        });
        if (!response.ok) throw new Error();
        setDraftStatus("saved");
        setDraftMessage("Draft saved");
      } catch {
        setDraftStatus("error");
        setDraftMessage("Draft could not be saved. Keep this page open.");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [content, draftHasContent, previewRecipientId, selectedIds]);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (draftStatus !== "saving" && draftStatus !== "error") return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draftStatus]);

  function updateContent(field: keyof EmailCampaignContent, value: string) {
    setContent((current) => ({ ...current, [field]: value }));
    setTestStatus("idle");
    setTestMessage("");
    setSendStatus("idle");
    setSendMessage("");
    setReview(null);
    setConfirmationInput("");
  }

  function toggleRecipient(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setReview(null);
    setConfirmationInput("");
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const recipient of visibleRecipients) {
        if (allVisibleSelected) next.delete(recipient.id);
        else next.add(recipient.id);
      }
      return next;
    });
    setReview(null);
    setConfirmationInput("");
  }

  function validatedContent() {
    const validation = validateEmailCampaignContent(content);
    if (!validation.ok) {
      setSendStatus("error");
      setSendMessage(validation.error);
      return null;
    }
    return validation.content;
  }

  async function sendTest() {
    const validation = validateEmailCampaignContent(content);
    if (!validation.ok) {
      setTestStatus("error");
      setTestMessage(validation.error);
      return;
    }
    setTestStatus("working");
    setTestMessage(`Sending a test only to ${ownerEmail}…`);
    try {
      const response = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.content),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The test email could not be sent."));
      setTestStatus("success");
      setTestMessage(`Test sent only to ${ownerEmail}. Check the inbox before reviewing the live campaign.`);
    } catch (error) {
      setTestStatus("error");
      setTestMessage(error instanceof Error ? error.message : "The test email could not be sent.");
    }
  }

  async function openReview() {
    const validation = validatedContent();
    if (!validation) return;
    if (!selectedIds.size) {
      setSendStatus("error");
      setSendMessage("Choose at least one recipient before reviewing the campaign.");
      return;
    }
    if (liveBlockingReasons.length) {
      setSendStatus("error");
      setSendMessage(liveBlockingReasons.join(" · "));
      return;
    }
    setSendStatus("working");
    setSendMessage("Locking this exact message and audience for review…");
    try {
      const response = await fetch("/api/admin/email/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validation, recipientIds: [...selectedIds] }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The campaign could not be reviewed."));
      setReview({
        confirmationId: String(result.confirmationId),
        confirmationText: String(result.confirmationText),
        expiresAt: String(result.expiresAt),
      });
      setConfirmationInput("");
      setSendStatus("idle");
      setSendMessage("");
    } catch (error) {
      setSendStatus("error");
      setSendMessage(error instanceof Error ? error.message : "The campaign could not be reviewed.");
    }
  }

  async function sendCampaign() {
    if (!review || confirmationInput !== review.confirmationText) return;
    const validation = validateEmailCampaignContent(content);
    if (!validation.ok) return;
    setSendStatus("working");
    setSendMessage(`Sending to ${selectedIds.size} recipients… Keep this page open.`);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validation.content,
          recipientIds: [...selectedIds],
          confirmationId: review.confirmationId,
          confirmationText: confirmationInput,
        }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The email could not be sent."));
      const sentCount = Number(result.sentCount ?? 0);
      const failedCount = Number(result.failedCount ?? 0);
      setSendStatus("success");
      setSendMessage(
        failedCount
          ? `${sentCount} sent; ${failedCount} failed. Open the delivery record to review or retry.`
          : `${sentCount} ${sentCount === 1 ? "email" : "emails"} sent successfully.`,
      );
      setReview(null);
      setConfirmationInput("");
      setSelectedIds(new Set());
      setContent(EMPTY_CONTENT);
      setDraftStatus("idle");
      setDraftMessage("");
      router.refresh();
    } catch (error) {
      setSendStatus("error");
      setSendMessage(error instanceof Error ? error.message : "The email could not be sent.");
      setReview(null);
      setConfirmationInput("");
    }
  }

  async function clearDraft() {
    await fetch("/api/admin/email/draft", { method: "DELETE" }).catch(() => undefined);
    setContent(EMPTY_CONTENT);
    setSelectedIds(new Set());
    setDraftStatus("idle");
    setDraftMessage("");
    setReview(null);
  }

  async function saveWebhookSecret() {
    if (!webhookSecret.trim().startsWith("whsec_")) {
      setWebhookStatus("error");
      setWebhookMessage("Paste the Resend signing secret beginning with whsec_.");
      return;
    }
    setWebhookStatus("working");
    setWebhookMessage("Saving the signing secret securely… No email will be sent.");
    try {
      const response = await fetch("/api/admin/email/webhook-protection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signingSecret: webhookSecret.trim() }),
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The signing secret could not be saved."));
      setWebhookConfigured(true);
      setWebhookVerified(false);
      setWebhookSecret("");
      setWebhookStatus("idle");
      setWebhookMessage("Secret saved. In Resend, send a test event to the webhook, then check the connection here.");
    } catch (error) {
      setWebhookStatus("error");
      setWebhookMessage(error instanceof Error ? error.message : "The signing secret could not be saved.");
    }
  }

  async function checkWebhookConnection() {
    setWebhookStatus("working");
    setWebhookMessage("Checking for a verified Resend event…");
    try {
      const response = await fetch("/api/admin/email/webhook-protection");
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The connection could not be checked."));
      const configured = result.configured === true;
      const verified = result.verified === true;
      setWebhookConfigured(configured);
      setWebhookVerified(verified);
      if (verified) {
        setWebhookStatus("success");
        setWebhookSetupOpen(false);
        setWebhookMessage("Bounce and complaint protection is verified and active.");
      } else {
        setWebhookStatus("idle");
        setWebhookMessage(
          configured
            ? "No verified event yet. Send a test event from the Resend webhook page, then check again."
            : "No signing secret is configured yet.",
        );
      }
    } catch (error) {
      setWebhookStatus("error");
      setWebhookMessage(error instanceof Error ? error.message : "The connection could not be checked.");
    }
  }

  async function copyWebhookEndpoint() {
    try {
      await navigator.clipboard.writeText(RESEND_WEBHOOK_ENDPOINT);
      setWebhookStatus("idle");
      setWebhookMessage("Webhook endpoint copied.");
    } catch {
      setWebhookStatus("error");
      setWebhookMessage("The endpoint could not be copied. Select it and copy it manually.");
    }
  }

  async function openCampaignDetail(campaignId: string) {
    setDetailStatus("working");
    setDetailMessage("Loading recipient delivery details…");
    setCampaignDetail(null);
    try {
      const response = await fetch(`/api/admin/email/campaigns/${encodeURIComponent(campaignId)}`);
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Campaign details could not be loaded."));
      setCampaignDetail(result.campaign as unknown as EmailCampaignDetail);
      setDetailStatus("success");
      setDetailMessage("");
      setRetryInput("");
      setRetryStatus("idle");
    } catch (error) {
      setDetailStatus("error");
      setDetailMessage(error instanceof Error ? error.message : "Campaign details could not be loaded.");
    }
  }

  async function retryFailures() {
    if (!campaignDetail) return;
    const failedCount = campaignDetail.recipients.filter((recipient) => recipient.status === "failed").length;
    if (retryInput !== `RETRY ${failedCount}`) return;
    setRetryStatus("working");
    try {
      const response = await fetch(
        `/api/admin/email/campaigns/${encodeURIComponent(campaignDetail.id)}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationText: retryInput }),
        },
      );
      const result = await responseJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "The retry could not be started."));
      setRetryStatus("success");
      setDetailMessage(`${Number(result.sentCount ?? 0)} failed deliveries retried successfully.`);
      await openCampaignDetail(campaignDetail.id);
      router.refresh();
    } catch (error) {
      setRetryStatus("error");
      setDetailMessage(error instanceof Error ? error.message : "The retry could not be started.");
    }
  }

  return (
    <>
      <ol className="admin-email-progress" aria-label="Email campaign steps">
        <li><span>1</span><div><strong>Write</strong><small>Create the message</small></div></li>
        <li><span>2</span><div><strong>Preview</strong><small>Check the final email</small></div></li>
        <li><span>3</span><div><strong>Audience</strong><small>Select recipients</small></div></li>
        <li><span>4</span><div><strong>Send</strong><small>Test, review and confirm</small></div></li>
      </ol>

      <section className="admin-email-metrics" aria-label="Mailing list overview">
        <article><span>Can receive email</span><strong>{recipients.length}</strong><small>Subscribed contacts available to select</small></article>
        <article><span>Survey complete</span><strong>{qualifiedCount}</strong><small>Qualified leads in the mailing list</small></article>
        <article><span>Unsubscribed</span><strong>{unsubscribedCount}</strong><small>Always excluded from sends</small></article>
        <article><span>Delivery blocked</span><strong>{deliverySuppressedCount}</strong><small>Bounces and complaints</small></article>
      </section>

      <section className="admin-email-readiness" aria-label="Live sending readiness">
        <div>
          <p className="eyebrow">Live sending safeguards</p>
          <h2>{liveBlockingReasons.length ? "Live campaigns are safely blocked" : "Ready for reviewed campaigns"}</h2>
          <p>
            Test emails can only go to <strong>{ownerEmail}</strong>. A live campaign requires an exact audience review, a single-use server approval, and typed confirmation.
          </p>
        </div>
        <ul>
          <li className={readiness.postalAddressConfigured ? "is-ready" : "is-blocked"}>
            <strong>Postal address</strong><span>{readiness.postalAddressConfigured ? readiness.postalAddress : "Required before live sending"}</span>
          </li>
          <li className={webhookVerified ? "is-ready" : "is-blocked"}>
            <strong>Bounce protection</strong><span>{webhookVerified ? "Verified and active" : webhookConfigured ? "Awaiting a verified test event" : "Not configured"}</span>
            {!webhookVerified ? <button type="button" onClick={() => setWebhookSetupOpen((open) => !open)} disabled={webhookStatus === "working"}>{webhookSetupOpen ? "Hide setup" : webhookConfigured ? "Finish setup" : "Set up protection"}</button> : null}
          </li>
        </ul>
      </section>
      {webhookSetupOpen && !webhookVerified ? <section className="admin-email-webhook-setup" aria-labelledby="webhook-setup-title">
        <div className="admin-email-webhook-setup__heading">
          <div><p className="eyebrow">Resend webhook</p><h3 id="webhook-setup-title">Connect delivery protection</h3></div>
          <p>This keeps the existing send-only API key restricted. Setup itself never sends an email.</p>
        </div>
        <ol>
          <li><a href="https://resend.com/webhooks" target="_blank" rel="noreferrer">Open Webhooks in Resend</a> and create a webhook.</li>
          <li><span>Use this endpoint:</span><div className="admin-email-webhook-endpoint"><code>{RESEND_WEBHOOK_ENDPOINT}</code><button type="button" onClick={copyWebhookEndpoint}>Copy endpoint</button></div></li>
          <li><span>Select these events:</span><div className="admin-email-webhook-events">{RESEND_WEBHOOK_EVENTS.map((eventName) => <code key={eventName}>{eventName}</code>)}</div></li>
          <li>Copy the webhook’s signing secret from Resend. It begins with <code>whsec_</code>.</li>
        </ol>
        <label className="admin-email-webhook-secret"><span>Signing secret</span><input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="whsec_…" autoComplete="off" spellCheck={false} /><small>The secret is stored server-side and is never displayed again.</small></label>
        <div className="admin-email-webhook-actions">
          <button className="button button--dark" type="button" onClick={saveWebhookSecret} disabled={webhookStatus === "working" || !webhookSecret.trim()}>{webhookStatus === "working" ? "Working…" : webhookConfigured ? "Replace signing secret" : "Save signing secret"}</button>
          {webhookConfigured ? <button className="button button--light" type="button" onClick={checkWebhookConnection} disabled={webhookStatus === "working"}>Check connection</button> : null}
        </div>
        {webhookConfigured ? <p className="admin-email-webhook-test-note">After saving, use <strong>Send test event</strong> on the Resend webhook page. Live campaigns stay blocked until that signed event is verified here.</p> : null}
      </section> : null}
      {webhookMessage ? <p className={`admin-email-inline-message is-${webhookStatus}`} role={webhookStatus === "error" ? "alert" : "status"}>{webhookMessage}</p> : null}
      {capacityExceeded ? <p className="admin-email-capacity-warning" role="alert">The mailing list is above the 5,000-recipient safety limit. Live sending remains blocked until the audience system is paginated beyond that limit.</p> : null}

      <div className="admin-email-workspace">
        <section className="admin-email-compose" aria-labelledby="compose-heading">
          <div className="admin-email-section-heading">
            <span className="admin-email-step-number" aria-hidden="true">1</span>
            <div><p className="eyebrow">Compose</p><h2 id="compose-heading">Write the update</h2><p>Start with what subscribers see in their inbox, then write the message itself.</p></div>
            <div className="admin-email-draft-state">
              <span className={`is-${draftStatus}`}>{draftMessage || "Autosaves after you begin"}</span>
              {draftHasContent ? <button type="button" onClick={clearDraft}>Delete draft</button> : null}
            </div>
          </div>
          <div className="admin-email-fields">
            <label><span>Subject line <i>Required</i></span><input type="text" value={content.subject} onChange={(event) => updateContent("subject", event.target.value)} maxLength={EMAIL_SUBJECT_MAX_LENGTH} placeholder="A meaningful update from Frame" /><small>{content.subject.length}/{EMAIL_SUBJECT_MAX_LENGTH}</small></label>
            <label><span>Preview text <i>Optional</i></span><input type="text" value={content.previewText} onChange={(event) => updateContent("previewText", event.target.value)} maxLength={EMAIL_PREVIEW_MAX_LENGTH} placeholder="A short line shown beside the subject" /><small>{content.previewText.length}/{EMAIL_PREVIEW_MAX_LENGTH}</small></label>
            <label><span>Email content <i>Required</i></span><textarea value={content.body} onChange={(event) => updateContent("body", event.target.value)} maxLength={EMAIL_BODY_MAX_LENGTH} placeholder={`Hi {{first_name}},\n\nHere’s what’s new at Frame…`} /><small className="admin-email-field-meta"><span>Tip: use <code>{"{{first_name}}"}</code> to personalise the message</span><span>{content.body.length}/{EMAIL_BODY_MAX_LENGTH}</span></small></label>
            <div className="admin-email-optional-heading"><span>Optional call to action</span><small>Add both fields to show a button in the email.</small></div>
            <div className="admin-email-cta-fields">
              <label><span>Button label</span><input type="text" value={content.ctaLabel} onChange={(event) => updateContent("ctaLabel", event.target.value)} maxLength={EMAIL_CTA_LABEL_MAX_LENGTH} placeholder="Read the update" /></label>
              <label><span>Button destination URL</span><input type="url" value={content.ctaUrl} onChange={(event) => updateContent("ctaUrl", event.target.value)} placeholder="https://framewearable.com/…" /></label>
            </div>
          </div>
        </section>

        <section className="admin-email-preview" aria-labelledby="preview-heading">
          <div className="admin-email-section-heading"><span className="admin-email-step-number" aria-hidden="true">2</span><div><p className="eyebrow">Preview</p><h2 id="preview-heading">Check before sending</h2><p>This is the exact email layout your selected recipient will see.</p></div></div>
          <div className="admin-email-preview-controls">
            <label htmlFor="preview-search">Find preview recipient</label>
            <input id="preview-search" type="search" value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Search name or email" />
            <label htmlFor="preview-recipient">Preview as</label>
            <select id="preview-recipient" value={previewRecipient?.id ?? ""} onChange={(event) => setPreviewRecipientId(Number(event.target.value))} disabled={!recipients.length}>
              {previewOptions.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipientName(recipient)} — {recipient.email}</option>)}
            </select>
          </div>
          <div className="admin-email-inbox-preview">
            <div className="admin-email-preview-chrome"><span></span><span></span><span></span><strong>Email preview</strong></div>
            <dl><div><dt>From</dt><dd>{readiness.from}</dd></div><div><dt>Reply to</dt><dd>{readiness.replyTo}</dd></div><div><dt>To</dt><dd>{previewRecipient?.email ?? "selected@recipient.com"}</dd></div><div><dt>Subject</dt><dd>{preview.subject}</dd></div></dl>
            <iframe title="Email body preview" srcDoc={preview.html} sandbox="" tabIndex={-1} />
          </div>
          <div className="admin-email-link-check">
            <strong>Links in this draft</strong>
            {emailLinks.length ? <ul>{emailLinks.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul> : <span>No body or button links yet.</span>}
          </div>
        </section>
      </div>

      <section className="admin-email-audience" aria-labelledby="audience-heading">
        <div className="admin-email-section-heading"><span className="admin-email-step-number" aria-hidden="true">3</span><div><p className="eyebrow">Audience</p><h2 id="audience-heading">Choose the recipients</h2><p>Filter the mailing list, then select only the people who should receive this update.</p></div><strong className="admin-email-selected-count">{selectedIds.size} selected</strong></div>
        <div className="admin-email-audience-tools">
          <div className="admin-email-filter-tabs" role="group" aria-label="Filter mailing list">
            {([ ["all", `All ${recipients.length}`], ["qualified", `Survey complete ${qualifiedCount}`], ["incomplete", `Survey incomplete ${recipients.length - qualifiedCount}`] ] as const).map(([value, label]) => <button key={value} type="button" className={audienceFilter === value ? "is-active" : undefined} onClick={() => setAudienceFilter(value)}>{label}</button>)}
          </div>
          <label className="admin-email-search"><span className="sr-only">Search mailing list</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /></label>
        </div>
        <div className="admin-email-select-bar">
          <label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!visibleRecipients.length} /><span>{allVisibleSelected ? "Deselect" : "Select"} all {visibleRecipients.length} shown</span></label>
          {selectedIds.size ? <button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button> : null}
        </div>
        <div className="admin-email-recipient-header" aria-hidden="true"><span></span><span>Subscriber</span><span>Waitlist status</span><span>Joined</span></div>
        <div className="admin-email-recipient-list">
          {visibleRecipients.map((recipient) => <label className="admin-email-recipient" key={recipient.id}><input type="checkbox" checked={selectedIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} /><span className="admin-email-recipient__identity"><strong>{recipientName(recipient)}</strong><small>{recipient.email}</small></span><span className={`admin-email-recipient__segment admin-email-recipient__segment--${recipient.qualificationStatus === "completed" ? "qualified" : "incomplete"}`}>{recipient.qualificationStatus === "completed" ? "Survey complete" : "Email only"}</span><time dateTime={recipient.joinedAt}>{formatDate(recipient.joinedAt)}</time></label>)}
          {!visibleRecipients.length ? <div className="admin-email-no-results"><strong>No matching subscribers</strong><span>Try a different search or audience filter.</span></div> : null}
        </div>
      </section>

      <section className="admin-email-send-panel" aria-label="Test and review email">
        <span className="admin-email-step-number admin-email-step-number--inverse" aria-hidden="true">4</span>
        <div><p className="eyebrow">Final check</p><h2>{selectedIds.size ? `${selectedIds.size} ${selectedIds.size === 1 ? "recipient" : "recipients"} selected` : "Test first, then review"}</h2><p>Tests only go to the signed-in administrator. Live sending is impossible until the exact audience is locked and the required phrase is typed.</p></div>
        <div className="admin-email-send-actions"><button className="button button--light" type="button" onClick={sendTest} disabled={testStatus === "working"}>{testStatus === "working" ? "Sending test…" : "Send test to me"}</button><button className="button button--light admin-email-review-button" type="button" onClick={openReview} disabled={sendStatus === "working" || selectedIds.size === 0 || liveBlockingReasons.length > 0}>{sendStatus === "working" ? "Preparing review…" : `Review campaign${selectedIds.size ? ` for ${selectedIds.size}` : ""}`}</button></div>
      </section>
      {testMessage ? <p className={`admin-email-send-message admin-email-send-message--${testStatus}`} role={testStatus === "error" ? "alert" : "status"}>{testMessage}</p> : null}
      <p className={`admin-email-send-message${sendStatus !== "idle" ? ` admin-email-send-message--${sendStatus}` : ""}`} role={sendStatus === "error" ? "alert" : "status"} aria-live="polite">{sendMessage}</p>

      <section className="admin-email-history" aria-labelledby="history-heading">
        <div className="admin-email-section-heading"><div><p className="eyebrow">Campaign history</p><h2 id="history-heading">Recent email activity</h2><p>A record of the latest campaigns and their final delivery status.</p></div></div>
        {campaigns.length ? <div className="admin-table-shell"><table className="admin-table"><thead><tr><th>Subject</th><th>Status</th><th>Recipients</th><th>Sent by</th><th>Created</th><th>Details</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td className="admin-email-history__subject"><strong>{campaign.subject}</strong></td><td><span className={`admin-email-history__status admin-email-history__status--${campaign.status}`}>{campaignStatusLabel(campaign.status)}</span>{campaign.failedCount ? <small>{campaign.failedCount} failed</small> : null}</td><td>{campaign.sentCount} / {campaign.recipientCount}</td><td>{campaign.createdBy}</td><td><time dateTime={campaign.createdAt}>{formatDateTime(campaign.createdAt)} UTC</time></td><td><button className="admin-email-detail-button" type="button" onClick={() => openCampaignDetail(campaign.id)}>View details</button></td></tr>)}</tbody></table></div> : <div className="admin-email-history__empty">No mailing-list emails have been sent yet.</div>}
      </section>

      {review ? <div className="admin-email-modal-backdrop" role="presentation"><section className="admin-email-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-review-title"><button className="admin-email-modal__close" type="button" onClick={() => { setReview(null); setConfirmationInput(""); }}>Close</button><p className="eyebrow">Final campaign review</p><h2 id="campaign-review-title">This will send a real email</h2><p className="admin-email-modal__warning">Review every detail. Once confirmed, email delivery cannot be recalled.</p><dl className="admin-email-review-summary"><div><dt>Subject</dt><dd>{preview.subject}</dd></div><div><dt>From</dt><dd>{readiness.from}</dd></div><div><dt>Audience</dt><dd>{selectedIds.size} people · {selectedQualifiedCount} survey complete · {selectedIds.size - selectedQualifiedCount} incomplete</dd></div><div><dt>Test status</dt><dd>{testStatus === "success" ? "Test email sent during this session" : "No successful test recorded during this session"}</dd></div></dl><div className="admin-email-review-sample"><strong>Recipient sample</strong><ul>{selectedRecipients.slice(0, 6).map((recipient) => <li key={recipient.id}>{recipientName(recipient)} <span>{recipient.email}</span></li>)}</ul>{selectedRecipients.length > 6 ? <p>Plus {selectedRecipients.length - 6} more selected recipients.</p> : null}</div><label className="admin-email-confirmation-field"><span>Type <strong>{review.confirmationText}</strong> exactly</span><input autoFocus type="text" value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value)} autoComplete="off" spellCheck={false} /></label><p>This single-use approval expires at {formatDateTime(review.expiresAt)} UTC.</p><button className="button button--dark" type="button" disabled={confirmationInput !== review.confirmationText || sendStatus === "working"} onClick={sendCampaign}>{sendStatus === "working" ? "Sending…" : `Send real campaign to ${selectedIds.size}`}</button></section></div> : null}

      {(detailStatus === "working" || detailStatus === "error" || campaignDetail) ? <div className="admin-email-modal-backdrop" role="presentation"><section className="admin-email-modal admin-email-modal--wide" role="dialog" aria-modal="true" aria-labelledby="campaign-detail-title"><button className="admin-email-modal__close" type="button" onClick={() => { setCampaignDetail(null); setDetailStatus("idle"); setDetailMessage(""); }}>Close</button><p className="eyebrow">Campaign delivery record</p><h2 id="campaign-detail-title">{campaignDetail?.subject ?? "Loading campaign…"}</h2>{detailMessage ? <p className={`admin-email-inline-message is-${detailStatus === "error" || retryStatus === "error" ? "error" : "success"}`} role={detailStatus === "error" || retryStatus === "error" ? "alert" : "status"}>{detailMessage}</p> : null}{campaignDetail ? <><div className="admin-email-detail-summary"><span>{campaignDetail.sentCount} sent</span><span>{campaignDetail.failedCount} failed</span><span>{campaignDetail.recipientCount} total</span></div><div className="admin-email-detail-list">{campaignDetail.recipients.map((recipient) => <article key={recipient.id}><div><strong>{recipient.name}</strong><span>{recipient.email}</span></div><span className={`admin-email-delivery-status is-${recipient.status}`}>{recipient.status}</span>{recipient.errorMessage ? <p>{recipient.errorMessage}</p> : null}</article>)}</div>{campaignDetail.recipients.some((recipient) => recipient.status === "failed") ? <div className="admin-email-retry-panel"><p>Only failed recipients will be retried. Already-sent recipients are excluded.</p><label><span>Type <strong>RETRY {campaignDetail.recipients.filter((recipient) => recipient.status === "failed").length}</strong></span><input value={retryInput} onChange={(event) => setRetryInput(event.target.value)} /></label><button className="button button--dark" type="button" onClick={retryFailures} disabled={retryStatus === "working" || retryInput !== `RETRY ${campaignDetail.recipients.filter((recipient) => recipient.status === "failed").length}`}>{retryStatus === "working" ? "Retrying…" : "Retry failed recipients"}</button></div> : null}</> : null}</section></div> : null}
    </>
  );
}
