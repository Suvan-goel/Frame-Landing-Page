export const PREORDER_DELIVERY_DRAFT_KEY = "frame-preorder-delivery-v1";
export const PREORDER_DELIVERY_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1_000;

export type PreorderDeliveryDraft = {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const DELIVERY_KEYS: (keyof PreorderDeliveryDraft)[] = [
  "email",
  "fullName",
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
];

export function serializePreorderDeliveryDraft(
  delivery: PreorderDeliveryDraft,
  savedAt = Date.now(),
) {
  return JSON.stringify({ savedAt, delivery });
}

export function parsePreorderDeliveryDraft(
  value: string | null,
  now = Date.now(),
): PreorderDeliveryDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      savedAt?: unknown;
      delivery?: Partial<Record<keyof PreorderDeliveryDraft, unknown>>;
    };
    if (
      typeof parsed.savedAt !== "number" ||
      parsed.savedAt > now ||
      now - parsed.savedAt > PREORDER_DELIVERY_DRAFT_MAX_AGE_MS ||
      !parsed.delivery ||
      DELIVERY_KEYS.some((key) => typeof parsed.delivery?.[key] !== "string")
    ) {
      return null;
    }
    return Object.fromEntries(
      DELIVERY_KEYS.map((key) => [key, parsed.delivery?.[key]]),
    ) as PreorderDeliveryDraft;
  } catch {
    return null;
  }
}
