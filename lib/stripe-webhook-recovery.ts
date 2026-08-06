export const STRIPE_WEBHOOK_STALE_AFTER_SECONDS = 300;

export function isStripeWebhookRecoveryEligible(input: {
  status: string;
  lastAttemptedAt: string | null;
  now?: number;
}) {
  if (input.status === "failed") return true;
  if (input.status !== "processing") return false;
  if (!input.lastAttemptedAt) return true;

  const lastAttemptedAt = Date.parse(input.lastAttemptedAt);
  if (!Number.isFinite(lastAttemptedAt)) return true;

  return (
    lastAttemptedAt <=
    (input.now ?? Date.now()) - STRIPE_WEBHOOK_STALE_AFTER_SECONDS * 1_000
  );
}
