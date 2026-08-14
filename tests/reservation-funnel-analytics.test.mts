import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReservationFunnelEvent,
  reservationFunnelEventNames,
} from "../lib/funnel-analytics.ts";

const baseEvent = {
  eventId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  event: "reservation_checkout_started",
  pagePath: "/preorder/review",
  properties: {
    source: "homepage_hero",
    attemptId: "33333333-3333-4333-8333-333333333333",
    utmCampaign: "reservation-launch",
  },
};

test("accepts a non-sensitive reservation funnel event", () => {
  assert.deepEqual(parseReservationFunnelEvent(baseEvent), baseEvent);
});

test("covers every required reservation funnel milestone", () => {
  assert.deepEqual(
    reservationFunnelEventNames,
    [
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
    ],
  );
});

test("rejects free text and health-answer properties", () => {
  assert.equal(
    parseReservationFunnelEvent({
      ...baseEvent,
      properties: {
        source: "homepage",
        email: "person@example.com",
        qualitativeDetail: "private medical information",
      },
    }),
    null,
  );
});

test("rejects query strings, fragments and unknown events", () => {
  assert.equal(
    parseReservationFunnelEvent({
      ...baseEvent,
      pagePath: "/preorder/review?email=person@example.com",
    }),
    null,
  );
  assert.equal(
    parseReservationFunnelEvent({
      ...baseEvent,
      event: "medical_answer_submitted",
    }),
    null,
  );
});

test("normalizes bounded analytics labels", () => {
  assert.deepEqual(
    parseReservationFunnelEvent({
      ...baseEvent,
      properties: { source: "  homepage   hero  " },
    }),
    {
      ...baseEvent,
      properties: { source: "homepage hero" },
    },
  );
});
