"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMAIL_BODY_MAX_LENGTH,
  EMAIL_CTA_LABEL_MAX_LENGTH,
  EMAIL_PREVIEW_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
  DEFAULT_EMAIL_CTA_POSITION,
  RESEND_WEBHOOK_ENDPOINT,
  RESEND_WEBHOOK_EVENTS,
  emailBodyParagraphs,
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
type WorkflowStep = "compose" | "audience" | "review";

const EMPTY_CONTENT: EmailCampaignContent = {
  subject: "",
  previewText: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  ctaPosition: DEFAULT_EMAIL_CTA_POSITION,
};

const PREVIEW_SAMPLE_CONTENT: EmailCampaignContent = {
  subject: "A closer look at what we’re building",
  previewText: "A short progress update from the Frame team.",
  body: `Hi {{first_name}},

We’ve been making thoughtful progress on Frame, refining both the wearable and the experience around it. Our focus remains simple: build technology that fits naturally into everyday life.

Thank you for being part of the journey. We’ll share more as the next stage takes shape.`,
  ctaLabel: "Discover Frame",
  ctaUrl: "https://framewearable.com",
  ctaPosition: DEFAULT_EMAIL_CTA_POSITION,
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

function senderDisplayName(from: string) {
  const addressStart = from.lastIndexOf("<");
  if (addressStart <= 0) return from;
  return from.slice(0, addressStart).trim().replace(/^"|"$/g, "") || from;
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
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("compose");

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
  const isEmptyDraft = [
    content.subject,
    content.previewText,
    content.body,
    content.ctaLabel,
    content.ctaUrl,
  ].every((value) => !value.trim());
  const ctaPositionOptions = useMemo(
    () =>
      emailBodyParagraphs(content.body)
        .slice(0, -1)
        .map((paragraph, index) => ({
          value: `after:${index + 1}` as const,
          label: `After paragraph ${index + 1} — ${paragraph.replace(/\s+/g, " ").slice(0, 48)}${paragraph.length > 48 ? "…" : ""}`,
        })),
    [content.body],
  );
  const previewContent: EmailCampaignContent = isEmptyDraft
    ? PREVIEW_SAMPLE_CONTENT
    : {
        subject: content.subject || "Your Frame update",
        previewText: content.previewText,
        body: content.body || "Your message will appear here.",
        ctaLabel: content.ctaLabel && content.ctaUrl ? content.ctaLabel : "",
        ctaUrl: content.ctaLabel && content.ctaUrl ? content.ctaUrl : "",
        ctaPosition: content.ctaPosition,
      };
  const preview = renderFrameCampaignEmail({
    content: previewContent,
    firstName: previewRecipient?.firstName ?? null,
    unsubscribeUrl: "https://framewearable.com/unsubscribe?token=preview",
    siteUrl: "https://framewearable.com",
    postalAddress: readiness.postalAddress,
  });
  const draftHasContent = !isEmptyDraft || selectedIds.size > 0;
  const selectedRecipients = recipients.filter((recipient) => selectedIds.has(recipient.id));
  const selectedQualifiedCount = selectedRecipients.filter(
    (recipient) => recipient.qualificationStatus === "completed",
  ).length;
  const liveBlockingReasons = [
    !readiness.postalAddressConfigured ? "Add Frame’s valid postal address" : "",
    !webhookVerified ? "Verify bounce and complaint protection" : "",
    capacityExceeded ? "The list exceeds the current 5,000-recipient safety limit" : "",
  ].filter(Boolean);
  const messageReady = validateEmailCampaignContent(content).ok;
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
    setContent((current) => {
      const next = { ...current, [field]: value } as EmailCampaignContent;
      if (field === "body" && next.ctaPosition !== DEFAULT_EMAIL_CTA_POSITION) {
        const requestedParagraph = Number(next.ctaPosition.slice("after:".length));
        if (requestedParagraph >= emailBodyParagraphs(value).length) {
          next.ctaPosition = DEFAULT_EMAIL_CTA_POSITION;
        }
      }
      return next;
    });
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
      setWorkflowStep("compose");
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
      setWebhookMessage("Secret saved. Send a test email only to yourself below, wait a few seconds, then check the connection.");
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
            ? "No verified event yet. Use Send test to me below, wait a few seconds, then check again."
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

  let reviewStepStatus = "Available";
  if (!messageReady) reviewStepStatus = "Message needed";
  else if (!selectedIds.size) reviewStepStatus = "Audience needed";
  else if (liveBlockingReasons.length) reviewStepStatus = `${liveBlockingReasons.length} blocked`;

  const workflowSteps: Array<{
    id: WorkflowStep;
    label: string;
    description: string;
    status: string;
  }> = [
    {
      id: "compose",
      label: "Message",
      description: "Write and preview",
      status: messageReady ? "Ready" : "In progress",
    },
    {
      id: "audience",
      label: "Audience",
      description: "Choose recipients",
      status: selectedIds.size ? `${selectedIds.size} selected` : "None selected",
    },
    {
      id: "review",
      label: "Review",
      description: "Test and confirm",
      status: reviewStepStatus,
    },
  ];

  return (
    <>
      <section className="email-studio" aria-label="Create an email campaign">
        <header className="email-studio__header">
          <div>
            <p className="eyebrow">New campaign</p>
            <h2>Create an email update</h2>
            <p>Move through one clear stage at a time. Your work saves automatically.</p>
          </div>
          <div className="email-studio__draft" aria-live="polite">
            <span className={`is-${draftStatus}`}>{draftMessage || "No draft changes yet"}</span>
            {draftHasContent ? <button type="button" onClick={clearDraft}>Delete draft</button> : null}
          </div>
        </header>

        <div className="email-studio__layout">
          <aside className="email-studio__sidebar">
            <nav aria-label="Campaign workflow">
              <ol className="email-studio__steps">
                {workflowSteps.map((step, index) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={workflowStep === step.id ? "is-active" : undefined}
                      aria-current={workflowStep === step.id ? "step" : undefined}
                      onClick={() => setWorkflowStep(step.id)}
                    >
                      <span className="email-studio__step-number">{index + 1}</span>
                      <span className="email-studio__step-copy">
                        <strong>{step.label}</strong>
                        <small>{step.description}</small>
                      </span>
                      <span className="email-studio__step-status">{step.status}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <section className="email-studio__list-summary" aria-label="Mailing list overview">
              <p>Mailing list</p>
              <dl>
                <div><dt>Available</dt><dd>{recipients.length}</dd></div>
                <div><dt>Survey complete</dt><dd>{qualifiedCount}</dd></div>
                <div><dt>Unsubscribed</dt><dd>{unsubscribedCount}</dd></div>
                <div><dt>Delivery blocked</dt><dd>{deliverySuppressedCount}</dd></div>
              </dl>
              <a href="#email-campaign-history">View campaign history</a>
            </section>
          </aside>

          <div className="email-studio__main">
            {workflowStep === "compose" ? (
              <section className="email-stage" aria-labelledby="email-message-heading">
                <header className="email-stage__header">
                  <div>
                    <p className="eyebrow">Step 1 of 3</p>
                    <h2 id="email-message-heading">Write and preview</h2>
                    <p>Build the message on the left and check the exact email on the right.</p>
                  </div>
                  <span className={`email-stage__status ${messageReady ? "is-ready" : ""}`}>
                    {messageReady ? "Message ready" : "Subject and message required"}
                  </span>
                </header>

                <div className="email-compose-grid">
                  <section className="email-card email-message-card" aria-label="Email message fields">
                    <div className="email-card__heading">
                      <div><span>Message</span><strong>What subscribers will read</strong></div>
                    </div>
                    <div className="email-form">
                      <label className="email-field">
                        <span>Subject line <i>Required</i></span>
                        <input type="text" value={content.subject} onChange={(event) => updateContent("subject", event.target.value)} maxLength={EMAIL_SUBJECT_MAX_LENGTH} placeholder="A meaningful update from Frame" />
                        <small>{content.subject.length}/{EMAIL_SUBJECT_MAX_LENGTH}</small>
                      </label>
                      <label className="email-field">
                        <span>Inbox preview <i>Optional</i></span>
                        <input type="text" value={content.previewText} onChange={(event) => updateContent("previewText", event.target.value)} maxLength={EMAIL_PREVIEW_MAX_LENGTH} placeholder="A short line shown beside the subject" />
                        <small>{content.previewText.length}/{EMAIL_PREVIEW_MAX_LENGTH}</small>
                      </label>
                      <label className="email-field">
                        <span>Email message <i>Required</i></span>
                        <textarea value={content.body} onChange={(event) => updateContent("body", event.target.value)} maxLength={EMAIL_BODY_MAX_LENGTH} placeholder={`Hi {{first_name}},\n\nHere’s what’s new at Frame…`} />
                        <small className="email-field__meta"><span>Use <code>{"{{first_name}}"}</code> to personalise</span><span>{content.body.length}/{EMAIL_BODY_MAX_LENGTH}</span></small>
                      </label>
                      <fieldset className="email-cta">
                        <legend>Optional button</legend>
                        <p>Add both fields, then choose where the button appears in the message.</p>
                        <div>
                          <label className="email-field"><span>Button label</span><input type="text" value={content.ctaLabel} onChange={(event) => updateContent("ctaLabel", event.target.value)} maxLength={EMAIL_CTA_LABEL_MAX_LENGTH} placeholder="Read the update" /></label>
                          <label className="email-field"><span>Destination URL</span><input type="url" value={content.ctaUrl} onChange={(event) => updateContent("ctaUrl", event.target.value)} placeholder="https://framewearable.com/…" /></label>
                          <label className="email-field email-cta__position"><span>Button position</span><select value={content.ctaPosition} onChange={(event) => updateContent("ctaPosition", event.target.value)}><option value={DEFAULT_EMAIL_CTA_POSITION}>End of message</option>{ctaPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        </div>
                      </fieldset>
                    </div>
                  </section>

                  <aside className="email-card email-preview-card" aria-labelledby="email-preview-heading">
                    <div className="email-card__heading email-card__heading--preview">
                      <div><span>Live preview</span><strong id="email-preview-heading">Check it as a subscriber</strong></div>
                      <span>{previewRecipient ? recipientName(previewRecipient) : "No recipient"}</span>
                    </div>
                    <div className="email-preview-controls">
                      <label htmlFor="preview-search-v2"><span>Find subscriber</span><input id="preview-search-v2" type="search" value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Search name or email" /></label>
                      <label htmlFor="preview-recipient-v2"><span>Preview as</span><select id="preview-recipient-v2" value={previewRecipient?.id ?? ""} onChange={(event) => setPreviewRecipientId(Number(event.target.value))} disabled={!recipients.length}>{previewOptions.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipientName(recipient)} | {recipient.email}</option>)}</select></label>
                    </div>
                    <div className="email-preview-window">
                      <div className="email-preview-window__bar"><span></span><span></span><span></span><strong>Email preview</strong></div>
                      <dl><div><dt>From</dt><dd>{senderDisplayName(readiness.from)}</dd></div><div><dt>To</dt><dd>{previewRecipient?.email ?? "selected@recipient.com"}</dd></div><div><dt>Subject</dt><dd>{preview.subject}</dd></div></dl>
                      <iframe title="Scrollable email body preview" srcDoc={preview.html} sandbox="" tabIndex={0} scrolling="yes" />
                    </div>
                    <div className="email-link-check"><strong>Links</strong>{emailLinks.length ? <ul>{emailLinks.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul> : <span>No links in this draft.</span>}</div>
                  </aside>
                </div>

                <footer className="email-stage__actions">
                  <div><strong>Happy with the message?</strong><span>Choose who should receive it next.</span></div>
                  <button className="button button--dark" type="button" onClick={() => setWorkflowStep("audience")}>Choose audience</button>
                </footer>
              </section>
            ) : null}

            {workflowStep === "audience" ? (
              <section className="email-stage" aria-labelledby="email-audience-heading">
                <header className="email-stage__header">
                  <div>
                    <p className="eyebrow">Step 2 of 3</p>
                    <h2 id="email-audience-heading">Choose the audience</h2>
                    <p>Filter the mailing list, then select exactly who should receive this update.</p>
                  </div>
                  <span className={`email-stage__status ${selectedIds.size ? "is-ready" : ""}`}>{selectedIds.size} selected</span>
                </header>

                <section className="email-card email-audience-card">
                  <div className="email-audience-tools">
                    <div className="email-filter-tabs" role="group" aria-label="Filter mailing list">
                      {([ ["all", `All ${recipients.length}`], ["qualified", `Survey complete ${qualifiedCount}`], ["incomplete", `Survey incomplete ${recipients.length - qualifiedCount}`] ] as const).map(([value, label]) => <button key={value} type="button" className={audienceFilter === value ? "is-active" : undefined} onClick={() => setAudienceFilter(value)}>{label}</button>)}
                    </div>
                    <label className="email-search"><span className="sr-only">Search mailing list</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" /></label>
                  </div>
                  <div className="email-select-bar">
                    <label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!visibleRecipients.length} /><span>{allVisibleSelected ? "Deselect" : "Select"} all {visibleRecipients.length} shown</span></label>
                    <div><strong>{selectedIds.size} selected</strong>{selectedIds.size ? <button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button> : null}</div>
                  </div>
                  <div className="email-recipient-header" aria-hidden="true"><span></span><span>Subscriber</span><span>Waitlist status</span><span>Joined</span></div>
                  <div className="email-recipient-list">
                    {visibleRecipients.map((recipient) => <label className="email-recipient" key={recipient.id}><input type="checkbox" checked={selectedIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} /><span className="email-recipient__identity"><strong>{recipientName(recipient)}</strong><small>{recipient.email}</small></span><span className={`email-recipient__segment ${recipient.qualificationStatus === "completed" ? "is-qualified" : ""}`}>{recipient.qualificationStatus === "completed" ? "Survey complete" : "Email only"}</span><time dateTime={recipient.joinedAt}>{formatDate(recipient.joinedAt)}</time></label>)}
                    {!visibleRecipients.length ? <div className="email-empty"><strong>No matching subscribers</strong><span>Try a different search or audience filter.</span></div> : null}
                  </div>
                </section>

                <footer className="email-stage__actions email-stage__actions--split">
                  <button className="email-text-button" type="button" onClick={() => setWorkflowStep("compose")}>Back to message</button>
                  <div><strong>{selectedIds.size ? `${selectedIds.size} ready to review` : "Select at least one recipient"}</strong><button className="button button--dark" type="button" onClick={() => setWorkflowStep("review")}>Review campaign</button></div>
                </footer>
              </section>
            ) : null}

            {workflowStep === "review" ? (
              <section className="email-stage" aria-labelledby="email-review-heading">
                <header className="email-stage__header">
                  <div>
                    <p className="eyebrow">Step 3 of 3</p>
                    <h2 id="email-review-heading">Review and send</h2>
                    <p>Confirm the message, audience, and delivery safeguards before sending anything.</p>
                  </div>
                  <span className={`email-stage__status ${messageReady && selectedIds.size && !liveBlockingReasons.length ? "is-ready" : ""}`}>{messageReady && selectedIds.size && !liveBlockingReasons.length ? "Ready for final review" : "Needs attention"}</span>
                </header>

                <div className="email-review-grid">
                  <section className="email-card email-review-summary-card" aria-label="Campaign summary">
                    <div className="email-card__heading"><div><span>Campaign summary</span><strong>What will be sent</strong></div><button type="button" onClick={() => setWorkflowStep("compose")}>Edit message</button></div>
                    <dl className="email-review-facts">
                      <div><dt>Subject</dt><dd>{content.subject || "No subject yet"}</dd></div>
                      <div><dt>Preview text</dt><dd>{content.previewText || "None"}</dd></div>
                      <div><dt>Audience</dt><dd>{selectedIds.size} people</dd></div>
                      <div><dt>Audience mix</dt><dd>{selectedQualifiedCount} survey complete · {selectedIds.size - selectedQualifiedCount} email only</dd></div>
                      <div><dt>Links</dt><dd>{emailLinks.length ? `${emailLinks.length} to check` : "No links"}</dd></div>
                    </dl>
                    <div className="email-review-recipients">
                      <div><strong>Recipient sample</strong><button type="button" onClick={() => setWorkflowStep("audience")}>Edit audience</button></div>
                      {selectedRecipients.length ? <ul>{selectedRecipients.slice(0, 5).map((recipient) => <li key={recipient.id}><span>{recipientName(recipient)}</span><small>{recipient.email}</small></li>)}</ul> : <p>No recipients selected yet.</p>}
                      {selectedRecipients.length > 5 ? <p>Plus {selectedRecipients.length - 5} more.</p> : null}
                    </div>
                  </section>

                  <section className="email-card email-send-card" aria-label="Delivery checks">
                    <div className="email-card__heading"><div><span>Delivery checks</span><strong>{liveBlockingReasons.length ? "Sending is blocked" : "Safeguards are ready"}</strong></div></div>
                    <ul className="email-safeguards">
                      <li className={readiness.postalAddressConfigured ? "is-ready" : "is-blocked"}><span></span><div><strong>Postal address</strong><small>{readiness.postalAddressConfigured ? readiness.postalAddress : "Required before live sending"}</small></div></li>
                      <li className={webhookVerified ? "is-ready" : "is-blocked"}><span></span><div><strong>Bounce protection</strong><small>{webhookVerified ? "Verified and active" : webhookConfigured ? "Awaiting a verified test event" : "Not configured"}</small></div>{!webhookVerified ? <button type="button" onClick={() => setWebhookSetupOpen((open) => !open)} disabled={webhookStatus === "working"}>{webhookSetupOpen ? "Hide setup" : webhookConfigured ? "Finish setup" : "Set up"}</button> : null}</li>
                      <li className={testStatus === "success" ? "is-ready" : "is-neutral"}><span></span><div><strong>Test email</strong><small>{testStatus === "success" ? "Sent during this session" : `Only sends to ${ownerEmail}`}</small></div></li>
                    </ul>
                    {webhookSetupOpen && !webhookVerified ? (
                      <section className="admin-email-webhook-setup" aria-labelledby="webhook-setup-title">
                        <div className="admin-email-webhook-setup__heading">
                          <div><p className="eyebrow">Resend webhook</p><h3 id="webhook-setup-title">Connect delivery protection</h3></div>
                          <p>Setup never sends an email.</p>
                        </div>
                        <ol>
                          <li><a href="https://resend.com/webhooks" target="_blank" rel="noreferrer">Open Webhooks in Resend</a> and create a webhook.</li>
                          <li><span>Use this endpoint:</span><div className="admin-email-webhook-endpoint"><code>{RESEND_WEBHOOK_ENDPOINT}</code><button type="button" onClick={copyWebhookEndpoint}>Copy endpoint</button></div></li>
                          <li><span>Select these events:</span><div className="admin-email-webhook-events">{RESEND_WEBHOOK_EVENTS.map((eventName) => <code key={eventName}>{eventName}</code>)}</div></li>
                          <li>Copy the signing secret beginning with <code>whsec_</code>.</li>
                        </ol>
                        <label className="admin-email-webhook-secret"><span>Signing secret</span><input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="whsec_…" autoComplete="off" spellCheck={false} /><small>Stored securely and never displayed again.</small></label>
                        <div className="admin-email-webhook-actions">
                          <button className="button button--dark" type="button" onClick={saveWebhookSecret} disabled={webhookStatus === "working" || !webhookSecret.trim()}>{webhookStatus === "working" ? "Working…" : webhookConfigured ? "Replace signing secret" : "Save signing secret"}</button>
                          {webhookConfigured ? <button className="button button--light" type="button" onClick={checkWebhookConnection} disabled={webhookStatus === "working"}>Check connection</button> : null}
                        </div>
                        {webhookConfigured ? <p className="admin-email-webhook-test-note">Use <strong>Send test to me</strong> below, wait a few seconds, then check the connection here.</p> : null}
                      </section>
                    ) : null}
                    {webhookMessage ? <p className={`admin-email-inline-message is-${webhookStatus}`} role={webhookStatus === "error" ? "alert" : "status"}>{webhookMessage}</p> : null}
                    {capacityExceeded ? <p className="admin-email-capacity-warning" role="alert">The mailing list is above the 5,000-recipient safety limit. Live sending remains blocked until the audience system is paginated beyond that limit.</p> : null}
                    <div className="email-send-actions">
                      <button className="button email-send-actions__test" type="button" onClick={sendTest} disabled={testStatus === "working"}>{testStatus === "working" ? "Sending test…" : "Send test to me"}</button>
                      <button className="button button--dark" type="button" onClick={openReview} disabled={sendStatus === "working" || selectedIds.size === 0 || liveBlockingReasons.length > 0}>{sendStatus === "working" ? "Preparing review…" : `Open final review${selectedIds.size ? ` · ${selectedIds.size}` : ""}`}</button>
                    </div>
                    <p className="email-send-note">A live send still requires the existing single-use approval and typed confirmation.</p>
                    {testMessage ? <p className={`admin-email-send-message admin-email-send-message--${testStatus}`} role={testStatus === "error" ? "alert" : "status"}>{testMessage}</p> : null}
                    <p className={`admin-email-send-message${sendStatus !== "idle" ? ` admin-email-send-message--${sendStatus}` : ""}`} role={sendStatus === "error" ? "alert" : "status"} aria-live="polite">{sendMessage}</p>
                  </section>
                </div>

                <footer className="email-stage__actions email-stage__actions--split">
                  <button className="email-text-button" type="button" onClick={() => setWorkflowStep("audience")}>Back to audience</button>
                  <span>Nothing sends until you complete the final confirmation.</span>
                </footer>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      <details className="email-history" id="email-campaign-history">
        <summary>
          <span><small>Campaign history</small><strong>Recent email activity</strong></span>
          <span>{campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"} <i aria-hidden="true">+</i></span>
        </summary>
        <div className="email-history__body">
          {campaigns.length ? <div className="admin-table-shell"><table className="admin-table"><thead><tr><th>Subject</th><th>Status</th><th>Recipients</th><th>Sent by</th><th>Created</th><th>Details</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td className="admin-email-history__subject"><strong>{campaign.subject}</strong></td><td><span className={`admin-email-history__status admin-email-history__status--${campaign.status}`}>{campaignStatusLabel(campaign.status)}</span>{campaign.failedCount ? <small>{campaign.failedCount} failed</small> : null}</td><td>{campaign.sentCount} / {campaign.recipientCount}</td><td>{campaign.createdBy}</td><td><time dateTime={campaign.createdAt}>{formatDateTime(campaign.createdAt)} UTC</time></td><td><button className="admin-email-detail-button" type="button" onClick={() => openCampaignDetail(campaign.id)}>View details</button></td></tr>)}</tbody></table></div> : <div className="admin-email-history__empty">No mailing-list emails have been sent yet.</div>}
        </div>
      </details>

      {review ? <div className="admin-email-modal-backdrop" role="presentation"><section className="admin-email-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-review-title"><button className="admin-email-modal__close" type="button" onClick={() => { setReview(null); setConfirmationInput(""); }}>Close</button><p className="eyebrow">Final campaign review</p><h2 id="campaign-review-title">This will send a real email</h2><p className="admin-email-modal__warning">Review every detail. Once confirmed, email delivery cannot be recalled.</p><dl className="admin-email-review-summary"><div><dt>Subject</dt><dd>{preview.subject}</dd></div><div><dt>From</dt><dd>{readiness.from}</dd></div><div><dt>Audience</dt><dd>{selectedIds.size} people · {selectedQualifiedCount} survey complete · {selectedIds.size - selectedQualifiedCount} incomplete</dd></div><div><dt>Test status</dt><dd>{testStatus === "success" ? "Test email sent during this session" : "No successful test recorded during this session"}</dd></div></dl><div className="admin-email-review-sample"><strong>Recipient sample</strong><ul>{selectedRecipients.slice(0, 6).map((recipient) => <li key={recipient.id}>{recipientName(recipient)} <span>{recipient.email}</span></li>)}</ul>{selectedRecipients.length > 6 ? <p>Plus {selectedRecipients.length - 6} more selected recipients.</p> : null}</div><label className="admin-email-confirmation-field"><span>Type <strong>{review.confirmationText}</strong> exactly</span><input autoFocus type="text" value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value)} autoComplete="off" spellCheck={false} /></label><p>This single-use approval expires at {formatDateTime(review.expiresAt)} UTC.</p><button className="button button--dark" type="button" disabled={confirmationInput !== review.confirmationText || sendStatus === "working"} onClick={sendCampaign}>{sendStatus === "working" ? "Sending…" : `Send real campaign to ${selectedIds.size}`}</button></section></div> : null}

      {(detailStatus === "working" || detailStatus === "error" || campaignDetail) ? <div className="admin-email-modal-backdrop" role="presentation"><section className="admin-email-modal admin-email-modal--wide" role="dialog" aria-modal="true" aria-labelledby="campaign-detail-title"><button className="admin-email-modal__close" type="button" onClick={() => { setCampaignDetail(null); setDetailStatus("idle"); setDetailMessage(""); }}>Close</button><p className="eyebrow">Campaign delivery record</p><h2 id="campaign-detail-title">{campaignDetail?.subject ?? "Loading campaign…"}</h2>{detailMessage ? <p className={`admin-email-inline-message is-${detailStatus === "error" || retryStatus === "error" ? "error" : "success"}`} role={detailStatus === "error" || retryStatus === "error" ? "alert" : "status"}>{detailMessage}</p> : null}{campaignDetail ? <><div className="admin-email-detail-summary"><span>{campaignDetail.sentCount} sent</span><span>{campaignDetail.failedCount} failed</span><span>{campaignDetail.recipientCount} total</span></div><div className="admin-email-detail-list">{campaignDetail.recipients.map((recipient) => <article key={recipient.id}><div><strong>{recipient.name}</strong><span>{recipient.email}</span></div><span className={`admin-email-delivery-status is-${recipient.status}`}>{recipient.status}</span>{recipient.errorMessage ? <p>{recipient.errorMessage}</p> : null}</article>)}</div>{campaignDetail.recipients.some((recipient) => recipient.status === "failed") ? <div className="admin-email-retry-panel"><p>Only failed recipients will be retried. Already-sent recipients are excluded.</p><label><span>Type <strong>RETRY {campaignDetail.recipients.filter((recipient) => recipient.status === "failed").length}</strong></span><input value={retryInput} onChange={(event) => setRetryInput(event.target.value)} /></label><button className="button button--dark" type="button" onClick={retryFailures} disabled={retryStatus === "working" || retryInput !== `RETRY ${campaignDetail.recipients.filter((recipient) => recipient.status === "failed").length}`}>{retryStatus === "working" ? "Retrying…" : "Retry failed recipients"}</button></div> : null}</> : null}</section></div> : null}
    </>
  );
}
