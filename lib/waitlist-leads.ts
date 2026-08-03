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
  created_at: string;
};

export type QualificationResponse = {
  mainReason: string | null;
  recentSituation: string | null;
  monitoringMethod: string | null;
  interviewWillingness: string | null;
};

export type LeadTab = "qualified" | "unqualified";

export const mainReasonLabels: Record<string, string> = {
  monitor_high_or_borderline: "Monitor high or borderline blood pressure",
  understand_sleep: "Understand blood pressure while sleeping",
  understand_daily_factors: "Understand food, alcohol, stress and exercise",
  understand_unexplained_changes: "Understand unexplained changes",
  track_response_and_recovery: "Track response and recovery",
  something_else: "Something else",
};

export const monitoringLabels: Record<string, string> = {
  upper_arm_regularly: "Upper-arm cuff regularly",
  upper_arm_occasionally: "Upper-arm cuff occasionally",
  wearable_or_cuffless: "Wearable or cuffless device",
  medical_appointments_only: "Medical appointments only",
  not_currently_monitoring: "Does not currently monitor",
};

export function parseQualificationResponse(
  motivation: string | null,
): QualificationResponse {
  const fallback = {
    mainReason: null,
    recentSituation: motivation,
    monitoringMethod: null,
    interviewWillingness: null,
  };
  if (!motivation?.startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(motivation) as Record<string, unknown>;
    if (parsed.version !== 2) return fallback;
    return {
      mainReason:
        typeof parsed.mainReason === "string" ? parsed.mainReason : null,
      recentSituation:
        typeof parsed.recentSituation === "string"
          ? parsed.recentSituation
          : null,
      monitoringMethod:
        typeof parsed.monitoringMethod === "string"
          ? parsed.monitoringMethod
          : null,
      interviewWillingness:
        typeof parsed.interviewWillingness === "string"
          ? parsed.interviewWillingness
          : null,
    };
  } catch {
    return fallback;
  }
}

export function isQualifiedSignup(
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

export function isVisibleSignup(signup: WaitlistSignup) {
  return signup.first_name?.trim().toLocaleLowerCase() !== "suvan";
}

export function categorizeSignup(signup: WaitlistSignup) {
  const qualification = parseQualificationResponse(signup.motivation);
  return {
    signup,
    qualification,
    tab: isQualifiedSignup(signup, qualification)
      ? ("qualified" as const)
      : ("unqualified" as const),
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
  "main_reason",
  "recent_situation",
  "monitoring_method",
  "interview_willingness",
  "motivation",
  "placement",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "created_at",
] as const;

export function toWaitlistExportRow(
  signup: WaitlistSignup,
  qualification = parseQualificationResponse(signup.motivation),
): WaitlistExportCell[] {
  return [
    signup.first_name,
    signup.last_name,
    signup.email,
    signup.gender,
    signup.age,
    qualification.mainReason,
    qualification.recentSituation,
    qualification.monitoringMethod,
    qualification.interviewWillingness,
    signup.motivation,
    signup.placement,
    signup.utm_source,
    signup.utm_medium,
    signup.utm_campaign,
    signup.created_at,
  ];
}
