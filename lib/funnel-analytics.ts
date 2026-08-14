export const reservationFunnelEventNames = [
  "waitlist_form_viewed",
  "waitlist_email_submitted",
  "waitlist_email_success",
  "waitlist_email_error",
  "qualification_started",
  "qualification_skipped",
  "qualification_completed",
  "preorder_decline_started",
  "preorder_decline_completed",
  "reservation_objection_selected",
  "reservation_price_objection_selected",
  "reservation_willingness_band_selected",
  "reservation_evidence_objection_selected",
  "reservation_evidence_requirement_selected",
  "reservation_cta_viewed",
  "reservation_cta_clicked",
  "reservation_checkout_started",
  "reservation_checkout_error",
  "reservation_completed",
] as const;

export type ReservationFunnelEventName =
  (typeof reservationFunnelEventNames)[number];

export const reservationFunnelPropertyNames = [
  "placement",
  "source",
  "result",
  "reason",
  "band",
  "requirement",
  "attemptId",
  "orderReference",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const;

type ReservationFunnelPropertyName =
  (typeof reservationFunnelPropertyNames)[number];

export type ReservationFunnelProperties = Partial<
  Record<ReservationFunnelPropertyName, string>
>;

export type ReservationFunnelEventInput = {
  eventId: string;
  sessionId: string;
  event: ReservationFunnelEventName;
  pagePath: string;
  properties: ReservationFunnelProperties;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAMES = new Set<string>(reservationFunnelEventNames);
const PROPERTY_NAMES = new Set<string>(reservationFunnelPropertyNames);
const MAX_PROPERTY_LENGTH = 200;
const MAX_PAGE_PATH_LENGTH = 200;

function cleanProperty(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, MAX_PROPERTY_LENGTH);
  return cleaned || null;
}

function cleanPagePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.includes("?") || value.includes("#") || value.length > MAX_PAGE_PATH_LENGTH) {
    return null;
  }
  return value;
}

export function parseReservationFunnelEvent(
  value: unknown,
): ReservationFunnelEventInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).some(
      (key) =>
        key !== "eventId" &&
        key !== "sessionId" &&
        key !== "event" &&
        key !== "pagePath" &&
        key !== "properties",
    ) ||
    typeof candidate.eventId !== "string" ||
    !UUID_PATTERN.test(candidate.eventId) ||
    typeof candidate.sessionId !== "string" ||
    !UUID_PATTERN.test(candidate.sessionId) ||
    typeof candidate.event !== "string" ||
    !EVENT_NAMES.has(candidate.event)
  ) {
    return null;
  }

  const pagePath = cleanPagePath(candidate.pagePath);
  if (!pagePath) return null;
  if (
    !candidate.properties ||
    typeof candidate.properties !== "object" ||
    Array.isArray(candidate.properties)
  ) {
    return null;
  }

  const rawProperties = candidate.properties as Record<string, unknown>;
  if (Object.keys(rawProperties).some((key) => !PROPERTY_NAMES.has(key))) {
    return null;
  }

  const properties: ReservationFunnelProperties = {};
  for (const [key, rawValue] of Object.entries(rawProperties)) {
    const cleaned = cleanProperty(rawValue);
    if (!cleaned) continue;
    properties[key as ReservationFunnelPropertyName] = cleaned;
  }

  return {
    eventId: candidate.eventId,
    sessionId: candidate.sessionId,
    event: candidate.event as ReservationFunnelEventName,
    pagePath,
    properties,
  };
}
