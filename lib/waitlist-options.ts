export const MONITORING_FREQUENCY_OPTIONS = [
  ["sixteen_or_more_days", "16–30 days"],
  ["eight_to_fifteen_days", "8–15 days"],
  ["three_to_seven_days", "3–7 days"],
  ["one_or_two_days", "1–2 days"],
  ["none_recently", "0 days - but I’ve measured outside an appointment before"],
  [
    "never_outside_appointment",
    "I’ve never measured my blood pressure outside an appointment",
  ],
] as const;

export const MONITORING_REASON_OPTIONS = [
  [
    "regular_routine",
    "It was part of my regular or clinician-recommended monitoring",
  ],
  [
    "recheck_reading_or_feeling",
    "I was rechecking an unusual reading or how I felt",
  ],
  [
    "medication_or_treatment",
    "I was tracking the effect of medication or treatment",
  ],
  [
    "daily_factor_effect",
    "I wanted to understand how it changed or what affected it",
  ],
  ["general_tracking", "General health tracking or curiosity"],
  ["another_reason", "Another reason"],
] as const;

export const MONITORING_READINESS_OPTIONS = [
  ["obtained_device", "I had a device but hadn’t used it"],
  [
    "compared_devices",
    "I had researched devices or asked a clinician what to use",
  ],
  ["thought_no_action", "I had thought about it but taken no action"],
  ["not_considered", "I hadn’t considered it before"],
] as const;

export const LEGACY_MONITORING_READINESS_OPTIONS = [
  ["asked_clinician", "I had asked a clinician what to use"],
] as const;

export const MONITORING_METHOD_OPTIONS = [
  ["automated_upper_arm", "An upper-arm cuff"],
  ["wrist_or_finger", "A wrist or finger monitor"],
  ["wearable_or_cuffless", "A wearable or cuffless device"],
  ["shared_machine", "A pharmacy, gym or other shared machine"],
  ["clinician_24_hour", "A clinician-provided monitor"],
  ["manual_or_other", "Something else or I don’t remember"],
] as const;

export const LEGACY_MONITORING_METHOD_OPTIONS = [
  ["do_not_remember", "I don’t remember"],
] as const;

export const MONITORING_OUTCOME_OPTIONS = [
  ["worked_easily", "It gave me what I needed easily"],
  [
    "worked_with_difficulty",
    "It gave me what I needed, but was difficult or inconvenient",
  ],
  ["easy_but_unanswered", "It left important questions unanswered"],
  ["reading_only", "I was only taking a reading, not trying to understand anything else"],
  ["not_sure", "I’m not sure"],
] as const;

export const LEGACY_MONITORING_OUTCOME_OPTIONS = [
  [
    "difficult_and_unanswered",
    "It was difficult and left important questions unanswered",
  ],
] as const;

export const QUALITATIVE_FOLLOW_UP_OUTCOMES = new Set<string>([
  "worked_with_difficulty",
  "easy_but_unanswered",
  "difficult_and_unanswered",
]);

export const PREORDER_DECLINE_REASON_OPTIONS = [
  ["need_more_evidence", "I need more evidence or product information"],
  ["do_not_preorder", "I don’t pre-order products before release"],
  ["price_too_high", "The price is more than I would pay"],
  ["not_urgent", "It isn’t a priority for me right now"],
  ["not_available_where_i_live", "Frame isn’t available where I live"],
  ["does_not_solve_need", "I’m not convinced it solves a problem I have"],
  ["another_reason", "Another reason"],
] as const;

export const LEGACY_PREORDER_DECLINE_REASON_OPTIONS = [
  ["need_more_product_detail", "I need more product details before deciding"],
  ["need_to_discuss", "I need to discuss it with someone first"],
] as const;

export type MonitoringFrequency =
  (typeof MONITORING_FREQUENCY_OPTIONS)[number][0];
export type MonitoringReason = (typeof MONITORING_REASON_OPTIONS)[number][0];
export type MonitoringReadiness =
  (typeof MONITORING_READINESS_OPTIONS)[number][0];
export type MonitoringMethod = (typeof MONITORING_METHOD_OPTIONS)[number][0];
export type MonitoringOutcome = (typeof MONITORING_OUTCOME_OPTIONS)[number][0];
export type PreorderDeclineReason =
  (typeof PREORDER_DECLINE_REASON_OPTIONS)[number][0];

export const monitoringFrequencyValues = new Set<string>(
  MONITORING_FREQUENCY_OPTIONS.map(([value]) => value),
);
export const monitoringReasonValues = new Set<string>(
  MONITORING_REASON_OPTIONS.map(([value]) => value),
);
export const monitoringReadinessValues = new Set<string>(
  [...MONITORING_READINESS_OPTIONS, ...LEGACY_MONITORING_READINESS_OPTIONS].map(
    ([value]) => value,
  ),
);
export const monitoringMethodValues = new Set<string>(
  [...MONITORING_METHOD_OPTIONS, ...LEGACY_MONITORING_METHOD_OPTIONS].map(
    ([value]) => value,
  ),
);
export const monitoringOutcomeValues = new Set<string>(
  [...MONITORING_OUTCOME_OPTIONS, ...LEGACY_MONITORING_OUTCOME_OPTIONS].map(
    ([value]) => value,
  ),
);
export const preorderDeclineReasonValues = new Set<string>(
  [
    ...PREORDER_DECLINE_REASON_OPTIONS,
    ...LEGACY_PREORDER_DECLINE_REASON_OPTIONS,
  ].map(([value]) => value),
);

// Legacy options remain available so existing survey records and old full-form
// submissions continue to render and validate correctly.
export const PRIMARY_INTEREST_OPTIONS = [
  ["monitor_high_or_borderline", "See my blood pressure patterns over time"],
  ["understand_sleep", "Understand my blood pressure while sleeping"],
  [
    "understand_daily_factors",
    "See how food, alcohol, stress and exercise affect me",
  ],
  [
    "understand_unexplained_changes",
    "Understand unexplained changes in my blood pressure",
  ],
  ["track_response_and_recovery", "Track cardiovascular response and recovery"],
  ["something_else", "Something else"],
] as const;

export const LEGACY_SURVEY_MONITORING_METHOD_OPTIONS = [
  ["upper_arm_regularly", "Upper-arm cuff regularly"],
  ["upper_arm_occasionally", "Upper-arm cuff occasionally"],
  ["medical_appointments_only", "Only during medical appointments"],
  ["not_currently_monitoring", "I do not currently monitor it"],
] as const;

export const RESEARCH_CALL_OPTIONS = [
  ["yes", "Yes"],
  ["possibly", "Possibly"],
  ["no", "No"],
] as const;

export const GENDER_OPTIONS = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["non_binary", "Non-binary"],
  ["another_identity", "Another identity"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;

export const primaryInterestValues = new Set<string>(
  PRIMARY_INTEREST_OPTIONS.map(([value]) => value),
);
export const researchCallValues = new Set<string>(
  RESEARCH_CALL_OPTIONS.map(([value]) => value),
);
export const genderValues = new Set<string>(
  GENDER_OPTIONS.map(([value]) => value),
);

export function normalizeResearchCallValue(value: string | null | undefined) {
  if (!value) return null;
  return value === "maybe" ? "possibly" : value;
}

export const EMAIL_FIRST_WAITLIST_HEADER =
  "x-frame-email-first-waitlist-request";
