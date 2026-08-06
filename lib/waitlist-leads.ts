import {
  MONITORING_METHOD_OPTIONS,
  PRIMARY_INTEREST_OPTIONS,
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
  current_monitoring_method: string | null;
  current_monitoring_method_other: string | null;
  frustration_or_missing_need: string | null;
  open_to_research_call: string | null;
  survey_completed_at: string | null;
  qualification_skipped_at: string | null;
  created_at: string;
};

export type QualificationResponse = {
  mainReason: string | null;
  mainReasonOther: string | null;
  recentSituation: string | null;
  monitoringMethod: string | null;
  monitoringMethodOther: string | null;
  interviewWillingness: string | null;
};

export type LeadTab = "qualified" | "unqualified";

export const WAITLIST_SIGNUP_SELECT =
  "id,first_name,last_name,email,gender,age,motivation,placement,utm_source,utm_medium,utm_campaign,utm_content,utm_term,signup_referrer,meta_click_id,qualification_status,primary_interest,primary_interest_other,current_monitoring_method,current_monitoring_method_other,frustration_or_missing_need,open_to_research_call,survey_completed_at,qualification_skipped_at,created_at";

export const mainReasonLabels: Record<string, string> = {
  ...Object.fromEntries(PRIMARY_INTEREST_OPTIONS),
  understand_sleep: "Understand blood pressure while sleeping",
  understand_unexplained_changes: "Understand unexplained changes",
  track_response_and_recovery: "Track response and recovery",
};

export const monitoringLabels: Record<string, string> = {
  ...Object.fromEntries(MONITORING_METHOD_OPTIONS),
};

export const qualificationStatusLabels: Record<QualificationStatus, string> = {
  not_started: "Email captured · survey not completed",
  skipped: "Email captured · survey skipped",
  completed: "Survey completed",
};

export function parseQualificationResponse(
  motivation: string | null,
): QualificationResponse {
  const fallback = {
    mainReason: null,
    mainReasonOther: null,
    recentSituation: motivation,
    monitoringMethod: null,
    monitoringMethodOther: null,
    interviewWillingness: null,
  };
  if (!motivation?.startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(motivation) as Record<string, unknown>;
    if (parsed.version !== 2) return fallback;
    return {
      mainReason:
        typeof parsed.mainReason === "string" ? parsed.mainReason : null,
      mainReasonOther: null,
      recentSituation:
        typeof parsed.recentSituation === "string"
          ? parsed.recentSituation
          : null,
      monitoringMethod:
        typeof parsed.monitoringMethod === "string"
          ? parsed.monitoringMethod
          : null,
      monitoringMethodOther: null,
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
  const legacy = parseQualificationResponse(signup.motivation);
  return {
    mainReason: signup.primary_interest ?? legacy.mainReason,
    mainReasonOther: signup.primary_interest_other,
    recentSituation:
      signup.frustration_or_missing_need ?? legacy.recentSituation,
    monitoringMethod:
      signup.current_monitoring_method ?? legacy.monitoringMethod,
    monitoringMethodOther: signup.current_monitoring_method_other,
    interviewWillingness:
      signup.open_to_research_call ?? legacy.interviewWillingness,
  };
}

function isLegacyQualified(
  signup: WaitlistSignup,
  qualification: QualificationResponse,
) {
  return Boolean(
    signup.first_name?.trim() &&
      signup.last_name?.trim() &&
      signup.gender &&
      Number.isInteger(signup.age) &&
      qualification.mainReason &&
      qualification.recentSituation &&
      qualification.monitoringMethod &&
      qualification.interviewWillingness,
  );
}

export function isQualifiedSignup(
  signup: WaitlistSignup,
  qualification: QualificationResponse,
) {
  if (signup.qualification_status === "completed") {
    return Boolean(qualification.mainReason && qualification.monitoringMethod);
  }
  return isLegacyQualified(signup, qualification);
}

export function isVisibleSignup(signup: WaitlistSignup) {
  return signup.first_name?.trim().toLocaleLowerCase() !== "suvan";
}

export function categorizeSignup(signup: WaitlistSignup) {
  const qualification = qualificationForSignup(signup);
  const qualified = isQualifiedSignup(signup, qualification);
  const qualificationStatus: QualificationStatus = qualified
    ? "completed"
    : signup.qualification_status ?? "not_started";
  return {
    signup,
    qualification,
    qualificationStatus,
    highIntent:
      qualified && qualification.interviewWillingness === "yes",
    tab: qualified ? ("qualified" as const) : ("unqualified" as const),
  };
}

export function categorizeVisibleSignups(signups: WaitlistSignup[]) {
  return signups.filter(isVisibleSignup).map(categorizeSignup);
}

export type WaitlistExportCell = string | number | null;

export const waitlistExportHeaders = [
  "first_name",
  "last_name",
  "email",
  "gender",
  "age",
  "qualification_status",
  "high_intent",
  "main_reason",
  "main_reason_other",
  "frustration_or_missing_need",
  "monitoring_method",
  "monitoring_method_other",
  "open_to_research_call",
  "motivation_legacy",
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
    signup.first_name,
    signup.last_name,
    signup.email,
    signup.gender,
    signup.age,
    categorized.qualificationStatus,
    categorized.highIntent ? "yes" : "no",
    qualification.mainReason,
    qualification.mainReasonOther,
    qualification.recentSituation,
    qualification.monitoringMethod,
    qualification.monitoringMethodOther,
    qualification.interviewWillingness,
    signup.motivation,
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
