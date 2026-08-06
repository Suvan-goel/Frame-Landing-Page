export const PRIMARY_INTEREST_OPTIONS = [
  [
    "monitor_high_or_borderline",
    "Understanding how my blood pressure changes throughout the day",
  ],
  [
    "understand_daily_factors",
    "Seeing how sleep, stress, exercise, diet or alcohol affect it",
  ],
  [
    "long_term_cardiovascular_health",
    "Keeping an eye on my long-term cardiovascular health",
  ],
  [
    "understand_blood_pressure_concern",
    "Managing or understanding an existing blood-pressure concern",
  ],
  [
    "health_technology_and_wearables",
    "I am interested in health technology and wearables",
  ],
  ["something_else", "Other"],
] as const;

export const MONITORING_METHOD_OPTIONS = [
  ["upper_arm_regularly", "I use a traditional blood-pressure cuff regularly"],
  ["upper_arm_occasionally", "I use a cuff occasionally"],
  ["wearable_or_cuffless", "I use a wearable or app"],
  ["medical_appointments_only", "It is mainly checked at medical appointments"],
  ["not_currently_monitoring", "I do not currently monitor it"],
  ["something_else", "Other"],
] as const;

export const RESEARCH_CALL_OPTIONS = [
  ["yes", "Yes"],
  ["maybe", "Maybe"],
  ["no", "No"],
] as const;

export type PrimaryInterest = (typeof PRIMARY_INTEREST_OPTIONS)[number][0];
export type MonitoringMethod = (typeof MONITORING_METHOD_OPTIONS)[number][0];
export type ResearchCallPreference = (typeof RESEARCH_CALL_OPTIONS)[number][0];

export const primaryInterestValues = new Set<string>(
  PRIMARY_INTEREST_OPTIONS.map(([value]) => value),
);

export const monitoringMethodValues = new Set<string>(
  MONITORING_METHOD_OPTIONS.map(([value]) => value),
);

export const researchCallValues = new Set<string>(
  RESEARCH_CALL_OPTIONS.map(([value]) => value),
);
