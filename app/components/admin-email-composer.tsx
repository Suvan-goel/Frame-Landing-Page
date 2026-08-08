"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMAIL_BODY_MAX_LENGTH,
  EMAIL_CTA_LABEL_MAX_LENGTH,
  EMAIL_PREVIEW_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
  renderFrameCampaignEmail,
  validateEmailCampaignContent,
  type EmailCampaignContent,
  type EmailCampaignSummary,
  type MailingListRecipient,
} from "@/lib/admin-email";

type AudienceFilter = "all" | "qualified" | "incomplete";
type SendStatus = "idle" | "sending" | "success" | "error";

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

export function AdminEmailComposer({
  recipients,
  suppressedCount,
  campaigns,
}: {
  recipients: MailingListRecipient[];
  suppressedCount: number;
  campaigns: EmailCampaignSummary[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [search, setSearch] = useState("");
  const [previewRecipientId, setPreviewRecipientId] = useState(
    recipients[0]?.id ?? 0,
  );
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendMessage, setSendMessage] = useState("");

  const qualifiedCount = useMemo(
    () => recipients.filter((recipient) => recipient.qualificationStatus === "completed").length,
    [recipients],
  );
  const visibleRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipients.filter((recipient) => {
      if (
        audienceFilter === "qualified" &&
        recipient.qualificationStatus !== "completed"
      ) {
        return false;
      }
      if (
        audienceFilter === "incomplete" &&
        recipient.qualificationStatus === "completed"
      ) {
        return false;
      }
      if (!query) return true;
      return `${recipientName(recipient)} ${recipient.email}`
        .toLowerCase()
        .includes(query);
    });
  }, [audienceFilter, recipients, search]);

  const allVisibleSelected =
    visibleRecipients.length > 0 &&
    visibleRecipients.every((recipient) => selectedIds.has(recipient.id));
  const previewRecipient =
    recipients.find((recipient) => recipient.id === previewRecipientId) ??
    recipients[0] ??
    null;
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
  });

  function updateContent(field: keyof EmailCampaignContent, value: string) {
    setContent((current) => ({ ...current, [field]: value }));
    if (sendStatus !== "sending") {
      setSendStatus("idle");
      setSendMessage("");
    }
  }

  function toggleRecipient(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSendStatus("idle");
    setSendMessage("");
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
    setSendStatus("idle");
    setSendMessage("");
  }

  async function sendCampaign() {
    const validation = validateEmailCampaignContent(content);
    if (!validation.ok) {
      setSendStatus("error");
      setSendMessage(validation.error);
      return;
    }
    if (selectedIds.size === 0) {
      setSendStatus("error");
      setSendMessage("Choose at least one recipient before sending.");
      return;
    }

    const confirmed = window.confirm(
      `Send “${validation.content.subject}” to ${selectedIds.size} ${
        selectedIds.size === 1 ? "person" : "people"
      }?\n\nEach person will receive an individual email. This cannot be undone.`,
    );
    if (!confirmed) return;

    setSendStatus("sending");
    setSendMessage(`Sending to ${selectedIds.size} recipients… Keep this page open.`);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validation.content,
          recipientIds: [...selectedIds],
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        sentCount?: number;
        failedCount?: number;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "The email could not be sent.");
      }

      const sentCount = result.sentCount ?? 0;
      const failedCount = result.failedCount ?? 0;
      setSendStatus("success");
      setSendMessage(
        failedCount
          ? `${sentCount} sent; ${failedCount} failed. The delivery record below has the final status.`
          : `${sentCount} ${sentCount === 1 ? "email" : "emails"} sent successfully.`,
      );
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setSendStatus("error");
      setSendMessage(
        error instanceof Error ? error.message : "The email could not be sent.",
      );
    }
  }

  return (
    <>
      <section className="admin-email-metrics" aria-label="Mailing list overview">
        <article>
          <span>Subscribed</span>
          <strong>{recipients.length}</strong>
          <small>Available to select</small>
        </article>
        <article>
          <span>Survey complete</span>
          <strong>{qualifiedCount}</strong>
          <small>Qualified waitlist leads</small>
        </article>
        <article>
          <span>Unsubscribed</span>
          <strong>{suppressedCount}</strong>
          <small>Always excluded from sends</small>
        </article>
      </section>

      <div className="admin-email-workspace">
        <section className="admin-email-compose" aria-labelledby="compose-heading">
          <div className="admin-email-section-heading">
            <div>
              <p className="eyebrow">01 · Compose</p>
              <h2 id="compose-heading">Write your email</h2>
            </div>
            <span>Draft stays on this page until sent</span>
          </div>

          <div className="admin-email-fields">
            <label>
              <span>Subject line</span>
              <input
                type="text"
                value={content.subject}
                onChange={(event) => updateContent("subject", event.target.value)}
                maxLength={EMAIL_SUBJECT_MAX_LENGTH}
                placeholder="A meaningful update from Frame"
              />
              <small>{content.subject.length}/{EMAIL_SUBJECT_MAX_LENGTH}</small>
            </label>
            <label>
              <span>Inbox preview text <i>Optional</i></span>
              <input
                type="text"
                value={content.previewText}
                onChange={(event) => updateContent("previewText", event.target.value)}
                maxLength={EMAIL_PREVIEW_MAX_LENGTH}
                placeholder="A short line shown beside the subject"
              />
              <small>{content.previewText.length}/{EMAIL_PREVIEW_MAX_LENGTH}</small>
            </label>
            <label>
              <span>Email content</span>
              <textarea
                value={content.body}
                onChange={(event) => updateContent("body", event.target.value)}
                maxLength={EMAIL_BODY_MAX_LENGTH}
                placeholder={`Hi {{first_name}},\n\nHere’s what’s new at Frame…`}
              />
              <small>
                Use {"{{first_name}}"} to personalise the message · {content.body.length}/{EMAIL_BODY_MAX_LENGTH}
              </small>
            </label>
            <div className="admin-email-cta-fields">
              <label>
                <span>Button label <i>Optional</i></span>
                <input
                  type="text"
                  value={content.ctaLabel}
                  onChange={(event) => updateContent("ctaLabel", event.target.value)}
                  maxLength={EMAIL_CTA_LABEL_MAX_LENGTH}
                  placeholder="Read the update"
                />
              </label>
              <label>
                <span>Button destination</span>
                <input
                  type="url"
                  value={content.ctaUrl}
                  onChange={(event) => updateContent("ctaUrl", event.target.value)}
                  placeholder="https://framewearable.com/…"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="admin-email-preview" aria-labelledby="preview-heading">
          <div className="admin-email-section-heading">
            <div>
              <p className="eyebrow">02 · Preview</p>
              <h2 id="preview-heading">See the final email</h2>
            </div>
          </div>
          <div className="admin-email-preview-controls">
            <label htmlFor="preview-recipient">Preview as</label>
            <select
              id="preview-recipient"
              value={previewRecipient?.id ?? ""}
              onChange={(event) => setPreviewRecipientId(Number(event.target.value))}
              disabled={!recipients.length}
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.firstName || recipient.email}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-email-inbox-preview">
            <dl>
              <div><dt>From</dt><dd>Frame Updates &lt;updates@framewearable.com&gt;</dd></div>
              <div><dt>To</dt><dd>{previewRecipient?.email ?? "selected@recipient.com"}</dd></div>
              <div><dt>Subject</dt><dd>{preview.subject}</dd></div>
            </dl>
            <iframe title="Email body preview" srcDoc={preview.html} tabIndex={-1} />
          </div>
        </section>
      </div>

      <section className="admin-email-audience" aria-labelledby="audience-heading">
        <div className="admin-email-section-heading">
          <div>
            <p className="eyebrow">03 · Audience</p>
            <h2 id="audience-heading">Choose exactly who receives it</h2>
          </div>
          <strong>{selectedIds.size} selected</strong>
        </div>

        <div className="admin-email-audience-tools">
          <div className="admin-email-filter-tabs" role="group" aria-label="Filter mailing list">
            {(
              [
                ["all", `All ${recipients.length}`],
                ["qualified", `Survey complete ${qualifiedCount}`],
                ["incomplete", `Survey incomplete ${recipients.length - qualifiedCount}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={audienceFilter === value ? "is-active" : undefined}
                onClick={() => setAudienceFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="admin-email-search">
            <span className="sr-only">Search mailing list</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
            />
          </label>
        </div>

        <div className="admin-email-select-bar">
          <label>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={!visibleRecipients.length}
            />
            <span>
              {allVisibleSelected ? "Deselect" : "Select"} all {visibleRecipients.length} shown
            </span>
          </label>
          {selectedIds.size ? (
            <button type="button" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
          ) : null}
        </div>

        <div className="admin-email-recipient-list">
          {visibleRecipients.map((recipient) => (
            <label className="admin-email-recipient" key={recipient.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(recipient.id)}
                onChange={() => toggleRecipient(recipient.id)}
              />
              <span className="admin-email-recipient__identity">
                <strong>{recipientName(recipient)}</strong>
                <small>{recipient.email}</small>
              </span>
              <span className={`admin-email-recipient__segment admin-email-recipient__segment--${recipient.qualificationStatus === "completed" ? "qualified" : "incomplete"}`}>
                {recipient.qualificationStatus === "completed" ? "Survey complete" : "Email only"}
              </span>
              <time dateTime={recipient.joinedAt}>
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                  new Date(recipient.joinedAt),
                )}
              </time>
            </label>
          ))}
          {!visibleRecipients.length ? (
            <div className="admin-email-no-results">
              <strong>No matching subscribers</strong>
              <span>Try a different search or audience filter.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-email-send-panel" aria-label="Send email">
        <div>
          <p className="eyebrow">Ready to send?</p>
          <h2>
            {selectedIds.size
              ? `${selectedIds.size} ${selectedIds.size === 1 ? "recipient" : "recipients"} selected`
              : "Choose your recipients"}
          </h2>
          <p>
            Every person receives a separate email with an unsubscribe link. You’ll confirm once more before anything is sent.
          </p>
        </div>
        <button
          className="button button--light"
          type="button"
          onClick={sendCampaign}
          disabled={sendStatus === "sending" || selectedIds.size === 0}
        >
          {sendStatus === "sending" ? "Sending…" : `Review and send${selectedIds.size ? ` to ${selectedIds.size}` : ""}`}
        </button>
      </section>
      <p
        className={`admin-email-send-message${sendStatus !== "idle" ? ` admin-email-send-message--${sendStatus}` : ""}`}
        role={sendStatus === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {sendMessage}
      </p>

      <section className="admin-email-history" aria-labelledby="history-heading">
        <div className="admin-email-section-heading">
          <div>
            <p className="eyebrow">Delivery record</p>
            <h2 id="history-heading">Recent sends</h2>
          </div>
        </div>
        {campaigns.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr><th>Subject</th><th>Status</th><th>Recipients</th><th>Sent by</th><th>Created</th></tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="admin-email-history__subject"><strong>{campaign.subject}</strong></td>
                    <td>
                      <span className={`admin-email-history__status admin-email-history__status--${campaign.status}`}>
                        {campaignStatusLabel(campaign.status)}
                      </span>
                      {campaign.failedCount ? <small>{campaign.failedCount} failed</small> : null}
                    </td>
                    <td>{campaign.sentCount} / {campaign.recipientCount}</td>
                    <td>{campaign.createdBy}</td>
                    <td><time dateTime={campaign.createdAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(campaign.createdAt))}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-email-history__empty">No mailing-list emails have been sent yet.</div>
        )}
      </section>
    </>
  );
}
