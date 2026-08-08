export const PREORDER_DELIVERY_NOTICE_TYPES = [
  "first_short_delay",
  "consent_required_delay",
  "material_product_change",
] as const;

export type PreorderDeliveryNoticeType =
  (typeof PREORDER_DELIVERY_NOTICE_TYPES)[number];

export type PreorderDeliveryResponseMode =
  | "silence_is_consent"
  | "affirmative_consent_required";

export const PREORDER_DELIVERY_RESPONSE_DEADLINE_MAX_DAYS = 30;

export function deliveryResponseModeForNotice(
  noticeType: PreorderDeliveryNoticeType,
): PreorderDeliveryResponseMode {
  return noticeType === "first_short_delay"
    ? "silence_is_consent"
    : "affirmative_consent_required";
}

export function canSendPreorderDeliveryNotice(input: {
  currentVersion: number;
  noticeType: PreorderDeliveryNoticeType;
}) {
  return !(
    input.noticeType === "first_short_delay" && input.currentVersion !== 0
  );
}

export function validPreorderDeliveryResponseDeadline(input: {
  responseMode: PreorderDeliveryResponseMode;
  responseDeadline: string | null;
  now?: Date;
}) {
  if (input.responseMode === "silence_is_consent") {
    return input.responseDeadline === null;
  }
  if (!input.responseDeadline) return false;

  const deadline = Date.parse(input.responseDeadline);
  const now = (input.now ?? new Date()).getTime();
  const latest = now + PREORDER_DELIVERY_RESPONSE_DEADLINE_MAX_DAYS * 86_400_000;
  return Number.isFinite(deadline) && deadline > now && deadline <= latest;
}

export function preorderDeliveryResponseExpired(input: {
  responseMode: string;
  responseDeadline: string | null;
  now?: Date;
}) {
  return (
    input.responseMode === "affirmative_consent_required" &&
    Boolean(input.responseDeadline) &&
    Date.parse(input.responseDeadline as string) <= (input.now ?? new Date()).getTime()
  );
}
