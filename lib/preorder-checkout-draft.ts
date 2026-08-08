export const PREORDER_DELIVERY_DRAFT_KEY = "frame-preorder-delivery-v1";
export const PREORDER_CHECKOUT_REQUEST_KEY = "frame-preorder-request-v1";
export const PREORDER_DELIVERY_DRAFT_MAX_AGE_MS = 55 * 60 * 1_000;

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

export function serializePreorderCheckoutRequestKey(
  requestKey: string,
  savedAt = Date.now(),
) {
  return JSON.stringify({ savedAt, requestKey });
}

export function parsePreorderCheckoutRequestKey(
  value: string | null,
  now = Date.now(),
) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { savedAt?: unknown; requestKey?: unknown };
    if (
      typeof parsed.savedAt !== "number" ||
      parsed.savedAt > now ||
      now - parsed.savedAt > PREORDER_DELIVERY_DRAFT_MAX_AGE_MS ||
      typeof parsed.requestKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.requestKey,
      )
    ) {
      return null;
    }
    return parsed.requestKey;
  } catch {
    return null;
  }
}
