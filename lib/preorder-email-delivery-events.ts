export const PREORDER_EMAIL_STATUS_BY_RESEND_EVENT = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
} as const;

export type TrackedPreorderEmailEvent =
  keyof typeof PREORDER_EMAIL_STATUS_BY_RESEND_EVENT;

export function preorderEmailStatusForResendEvent(eventType: string) {
  return PREORDER_EMAIL_STATUS_BY_RESEND_EVENT[
    eventType as TrackedPreorderEmailEvent
  ] ?? null;
}

export function normalizedResendEventTimestamp(
  value: string | undefined,
  fallback: string,
) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}
