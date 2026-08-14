import {
  GENDER_OPTIONS,
  LEGACY_MONITORING_METHOD_OPTIONS,
  LEGACY_MONITORING_OUTCOME_OPTIONS,
  LEGACY_MONITORING_READINESS_OPTIONS,
  LEGACY_PREORDER_DECLINE_REASON_OPTIONS,
  LEGACY_SURVEY_MONITORING_METHOD_OPTIONS,
  MONITORING_FREQUENCY_OPTIONS,
  MONITORING_METHOD_OPTIONS,
  MONITORING_OUTCOME_OPTIONS,
  MONITORING_READINESS_OPTIONS,
  MONITORING_REASON_OPTIONS,
  PREORDER_DECLINE_REASON_OPTIONS,
  PRIMARY_INTEREST_OPTIONS,
  RESEARCH_CALL_OPTIONS,
  normalizeResearchCallValue,
} from "./waitlist-options";

export type QualificationStatus = "not_started" | "skipped" | "completed";

export type WaitlistSignup = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  gender: string | null;
  age: number | null;
  motivation: string | null;
  placement: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  signup_referrer: string | null;
  meta_click_id: string | null;
  qualification_status: QualificationStatus;
  primary_interest: string | null;
  primary_interest_other: string | null;
  monitoring_frequency: string | null;
  monitoring_reason: string | null;
  monitoring_readiness: string | null;
  current_monitoring_method: string | null;
  current_monitoring_method_other: string | null;
  monitoring_outcome: string | null;
  frustration_or_missing_need: string | null;
  preorder_decline_reason: string | null;
  preorder_decline_detail: string | null;
  preorder_declined_at: string | null;
  open_to_research_call: string | null;
  survey_completed_at: string | null;
  qualification_skipped_at: string | null;
  created_at: string;
};

export type QualificationResponse = {
  monitoringFrequency: string | null;
  monitoringReason: string | null;
  monitoringReadiness: string | null;
  monitoringMethod: string | null;
  monitoringMethodOther: string | null;
  monitoringOutcome: string | null;
  qualitativeDetail: string | null;
  preorderDeclineReason: string | null;
  preorderDeclineDetail: string | null;
  legacyMainReason: string | null;
  legacyMainReasonOther: string | null;
  interviewWillingness: string | null;
};

export type LeadTab = "qualified" | "unqualified";
export type SurveyFlow = "new" | "legacy";

export const WAITLIST_SIGNUP_SELECT =
  "id,first_name,last_name,email,gender,age,motivation,placement,utm_source,utm_medium,utm_campaign,utm_content,utm_term,signup_referrer,meta_click_id,qualification_status,primary_interest,primary_interest_other,monitoring_frequency,monitoring_reason,monitoring_readiness,current_monitoring_method,current_monitoring_method_other,monitoring_outcome,frustration_or_missing_need,preorder_decline_reason,preorder_decline_detail,preorder_declined_at,open_to_research_call,survey_completed_at,qualification_skipped_at,created_at";

export const monitoringFrequencyLabels: Record<string, string> =
  Object.fromEntries(MONITORING_FREQUENCY_OPTIONS);
export const monitoringReasonLabels: Record<string, string> = Object.fromEntries(
  MONITORING_REASON_OPTIONS,
);
export const monitoringReadinessLabels: Record<string, string> =
  Object.fromEntries([
    ...MONITORING_READINESS_OPTIONS,
    ...LEGACY_MONITORING_READINESS_OPTIONS,
  ]);
export const monitoringLabels: Record<string, string> = Object.fromEntries(
  [
    ...MONITORING_METHOD_OPTIONS,
    ...LEGACY_MONITORING_METHOD_OPTIONS,
    ...LEGACY_SURVEY_MONITORING_METHOD_OPTIONS,
  ],
);
export const monitoringOutcomeLabels: Record<string, string> = Object.fromEntries(
  [...MONITORING_OUTCOME_OPTIONS, ...LEGACY_MONITORING_OUTCOME_OPTIONS],
);
export const preorderDeclineReasonLabels: Record<string, string> =
  Object.fromEntries([
    ...PREORDER_DECLINE_REASON_OPTIONS,
    ...LEGACY_PREORDER_DECLINE_REASON_OPTIONS,
  ]);
export const mainReasonLabels: Record<string, string> = Object.fromEntries(
  PRIMARY_INTEREST_OPTIONS,
);
export const genderLabels: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS,
);
export const interviewLabels: Record<string, string> = Object.fromEntries(
  RESEARCH_CALL_OPTIONS,
);

export const qualificationStatusLabels: Record<QualificationStatus, string> = {
  not_started: "Email captured · survey not completed",
  skipped: "Email captured · survey skipped",
  completed: "Survey completed",
};

function legacyQualification(motivation: string | null) {
  const fallback = {
    mainReason: null as string | null,
    monitoringMethod: null as string | null,
    recentSituation: motivation,
    interviewWillingness: null as string | null,
  };
  if (!motivation?.startsWith("{")) return fallback;
  try {
    const parsed = JSON.parse(motivation) as Record<string, unknown>;
    if (parsed.version !== 2) return fallback;
    return {
      mainReason: typeof parsed.mainReason === "string" ? parsed.mainReason : null,
      monitoringMethod:
        typeof parsed.monitoringMethod === "string" ? parsed.monitoringMethod : null,
      recentSituation:
        typeof parsed.recentSituation === "string" ? parsed.recentSituation : null,
      interviewWillingness:
        typeof parsed.interviewWillingness === "string"
          ? parsed.interviewWillingness
          : null,
    };
  } catch {
    return fallback;
  }
}

export function qualificationForSignup(
  signup: WaitlistSignup,
): QualificationResponse {
  const legacy = legacyQualification(signup.motivation);
  return {
    monitoringFrequency: signup.monitoring_frequency,
    monitoringReason: signup.monitoring_reason,
    monitoringReadiness: signup.monitoring_readiness,
    monitoringMethod:
      signup.current_monitoring_method ?? legacy.monitoringMethod,
    monitoringMethodOther: signup.current_monitoring_method_other,
    monitoringOutcome: signup.monitoring_outcome,
    qualitativeDetail:
      signup.frustration_or_missing_need ?? legacy.recentSituation,
    preorderDeclineReason: signup.preorder_decline_reason,
    preorderDeclineDetail: signup.preorder_decline_detail,
    legacyMainReason: signup.primary_interest ?? legacy.mainReason,
    legacyMainReasonOther: signup.primary_interest_other,
    interviewWillingness: normalizeResearchCallValue(
      signup.open_to_research_call ?? legacy.interviewWillingness,
    ),
  };
}

export function isQualifiedSignup(
  signup: WaitlistSignup,
  qualification: QualificationResponse,
) {
  if (signup.qualification_status !== "completed") return false;
  if (qualification.monitoringFrequency === "never_outside_appointment") {
    return Boolean(qualification.monitoringReadiness);
  }
  if (qualification.monitoringFrequency) {
    return Boolean(
      qualification.monitoringReason &&
        qualification.monitoringMethod &&
        qualification.monitoringOutcome,
    );
  }
  return Boolean(
    qualification.legacyMainReason && qualification.monitoringMethod,
  );
}

export function categorizeSignup(signup: WaitlistSignup) {
  const qualification = qualificationForSignup(signup);
  const qualified = isQualifiedSignup(signup, qualification);
  const surveyFlow: SurveyFlow | null = qualified
    ? qualification.monitoringFrequency
      ? "new"
      : "legacy"
    : null;
  const qualificationStatus: QualificationStatus = qualified
    ? "completed"
    : signup.qualification_status ?? "not_started";
  const qualitativeInsight = Boolean(qualification.qualitativeDetail?.trim());
  return {
    signup,
    qualification,
    qualificationStatus,
    qualitativeInsight,
    surveyFlow,
    // Retained as an alias for older admin consumers. It now means the user
    // voluntarily supplied qualitative detail, not purchase intent.
    highIntent: qualitativeInsight,
    tab: qualified ? ("qualified" as const) : ("unqualified" as const),
  };
}

export function categorizeVisibleSignups(signups: WaitlistSignup[]) {
  return signups.map(categorizeSignup);
}

export type WaitlistExportCell = string | number | null;

export const waitlistExportHeaders = [
  "email",
  "first_name",
  "last_name",
  "gender",
  "age",
  "qualification_status",
  "survey_flow",
  "provided_qualitative_insight",
  "monitoring_frequency_30_days",
  "most_recent_reason",
  "never_monitored_readiness",
  "most_recent_method",
  "most_recent_method_other",
  "most_recent_outcome",
  "qualitative_detail",
  "not_ready_to_preorder_reason",
  "not_ready_to_preorder_detail",
  "not_ready_to_preorder_recorded_at",
  "legacy_main_reason",
  "legacy_main_reason_other",
  "legacy_open_to_research_call",
  "placement",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "signup_referrer",
  "meta_click_id",
  "survey_completed_at",
  "created_at",
] as const;

export function toWaitlistExportRow(
  signup: WaitlistSignup,
  qualification = qualificationForSignup(signup),
): WaitlistExportCell[] {
  const categorized = categorizeSignup(signup);
  return [
    signup.email,
    signup.first_name,
    signup.last_name,
    signup.gender,
    signup.age,
    categorized.qualificationStatus,
    categorized.surveyFlow,
    categorized.qualitativeInsight ? "yes" : "no",
    qualification.monitoringFrequency,
    qualification.monitoringReason,
    qualification.monitoringReadiness,
    qualification.monitoringMethod,
    qualification.monitoringMethodOther,
    qualification.monitoringOutcome,
    qualification.qualitativeDetail,
    qualification.preorderDeclineReason,
    qualification.preorderDeclineDetail,
    signup.preorder_declined_at,
    qualification.legacyMainReason,
    qualification.legacyMainReasonOther,
    qualification.interviewWillingness,
    signup.placement,
    signup.utm_source,
    signup.utm_medium,
    signup.utm_campaign,
    signup.utm_content,
    signup.utm_term,
    signup.signup_referrer,
    signup.meta_click_id,
    signup.survey_completed_at,
    signup.created_at,
  ];
}
