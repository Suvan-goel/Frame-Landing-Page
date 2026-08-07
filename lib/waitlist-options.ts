export const PRIMARY_INTEREST_OPTIONS = [
  [
    "monitor_high_or_borderline",
    "See my blood pressure patterns over time",
  ],
  ["understand_sleep", "Understand my blood pressure while sleeping"],
  [
    "understand_daily_factors",
    "See how food, alcohol, stress and exercise affect me",
  ],
  [
    "understand_unexplained_changes",
    "Understand unexplained changes in my blood pressure",
  ],
  [
    "track_response_and_recovery",
    "Track cardiovascular response and recovery",
  ],
  ["something_else", "Something else"],
] as const;

export const MONITORING_METHOD_OPTIONS = [
  ["upper_arm_regularly", "Upper-arm cuff regularly"],
  ["upper_arm_occasionally", "Upper-arm cuff occasionally"],
  ["wearable_or_cuffless", "Wearable or cuffless device"],
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

export type PrimaryInterest = (typeof PRIMARY_INTEREST_OPTIONS)[number][0];
export type MonitoringMethod = (typeof MONITORING_METHOD_OPTIONS)[number][0];
export type ResearchCallPreference = (typeof RESEARCH_CALL_OPTIONS)[number][0];
export type Gender = (typeof GENDER_OPTIONS)[number][0];

export const primaryInterestValues = new Set<string>(
  PRIMARY_INTEREST_OPTIONS.map(([value]) => value),
);

export const monitoringMethodValues = new Set<string>(
  MONITORING_METHOD_OPTIONS.map(([value]) => value),
);

export const researchCallValues = new Set<string>(
  RESEARCH_CALL_OPTIONS.map(([value]) => value),
);

export function normalizeResearchCallValue(value: string | null | undefined) {
  if (!value) return null;
  return value === "maybe" ? "possibly" : value;
}

export const genderValues = new Set<string>(
  GENDER_OPTIONS.map(([value]) => value),
);
