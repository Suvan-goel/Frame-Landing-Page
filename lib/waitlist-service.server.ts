export type WaitlistRecordState = {
  id: number;
  signupToken: string;
  metaEventId: string;
  createdAt: string;
  qualificationStatus: string;
  surveyCompletedAt: string | null;
};

export type MetaLeadRecord = {
  metaEventId: string;
  email: string;
  metaClickId: string | null;
  createdAt: string;
  metaCapiStatus: string;
};

export type MetaTrackingDiagnosticsUpdate = {
  policyMode?: "explicit-consent" | "us-opt-out";
  consentState?: "granted" | "denied" | "unset";
  decision?: string;
  clientStateValid?: boolean;
  globalPrivacyControl?: boolean;
  pixelReadyAtCapture?: boolean;
  browserLeadAttemptedAt?: string;
  capiStatus?:
    | "not_attempted"
    | "sent"
    | "skipped_not_configured"
    | "skipped_not_permitted"
    | "failed";
  capiSentAt?: string | null;
  capiLastError?: string | null;
  recordedAt?: string;
  geoSource?: "netlify_context_geo" | "unknown";
  geoCountry?: string | null;
  geoRegionCode?: string | null;
  geoResolutionReason?: string;
  geoPolicyVersion?: string | null;
  geoRetryAttempted?: boolean;
  geoRetrySucceeded?: boolean;
};

export type NewWaitlistRecord = {
  email: string;
  placement: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  metaClickId: string | null;
  referrer: string | null;
};

export type QualificationUpdate = {
  monitoringFrequency: string;
  monitoringReason: string | null;
  monitoringReadiness: string | null;
  monitoringMethod: string | null;
  monitoringOutcome: string | null;
  qualitativeDetail: string | null;
  completedAt: string;
};

export type PreorderDeclineUpdate = {
  reason: string;
  detail: string | null;
  willingnessToPayBand: string | null;
  evidenceRequirements: string[] | null;
  evidenceRequirementsOther: string | null;
  openToResearchCall: string;
  recordedAt: string;
};

export type WaitlistRepository = {
  findByEmail(email: string): Promise<WaitlistRecordState | null>;
  insert(input: NewWaitlistRecord): Promise<WaitlistRecordState>;
  resubscribe(id: number): Promise<void>;
  findByToken(signupToken: string): Promise<WaitlistRecordState | null>;
  findMetaLeadByEventId(metaEventId: string): Promise<MetaLeadRecord | null>;
  updateMetaTrackingDiagnostics(
    metaEventId: string,
    update: MetaTrackingDiagnosticsUpdate,
  ): Promise<void>;
  markSkipped(id: number, skippedAt: string): Promise<void>;
  completeIfIncomplete(
    id: number,
    update: QualificationUpdate,
  ): Promise<boolean>;
  recordPreorderDecline(
    id: number,
    update: PreorderDeclineUpdate,
  ): Promise<boolean>;
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function captureWaitlistEmail(
  repository: WaitlistRepository,
  input: NewWaitlistRecord,
) {
  const existing = await repository.findByEmail(input.email);
  if (existing) {
    await repository.resubscribe(existing.id);
    return {
      status: "already_registered" as const,
      signupToken: existing.signupToken,
      metaEventId: existing.metaEventId,
      leadCreated: false,
    };
  }

  try {
    const inserted = await repository.insert(input);
    return {
      status: "joined" as const,
      signupToken: inserted.signupToken,
      metaEventId: inserted.metaEventId,
      leadCreated: true,
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await repository.findByEmail(input.email);
    if (!raced) throw error;
    await repository.resubscribe(raced.id);
    return {
      status: "already_registered" as const,
      signupToken: raced.signupToken,
      metaEventId: raced.metaEventId,
      leadCreated: false,
    };
  }
}

export async function skipWaitlistQualification(
  repository: WaitlistRepository,
  signupToken: string,
  skippedAt: string,
) {
  const existing = await repository.findByToken(signupToken);
  if (!existing) return { status: "not_found" as const };
  if (
    existing.qualificationStatus === "completed" ||
    existing.surveyCompletedAt
  ) {
    return { status: "already_completed" as const };
  }
  await repository.markSkipped(existing.id, skippedAt);
  return { status: "skipped" as const };
}

export async function completeWaitlistQualification(
  repository: WaitlistRepository,
  signupToken: string,
  update: QualificationUpdate,
) {
  const existing = await repository.findByToken(signupToken);
  if (!existing) {
    return { status: "not_found" as const, qualifiedLeadCreated: false };
  }
  if (
    existing.qualificationStatus === "completed" ||
    existing.surveyCompletedAt
  ) {
    return {
      status: "already_completed" as const,
      qualifiedLeadCreated: false,
    };
  }

  const completed = await repository.completeIfIncomplete(existing.id, update);
  return completed
    ? { status: "completed" as const, qualifiedLeadCreated: true }
    : { status: "already_completed" as const, qualifiedLeadCreated: false };
}

export async function recordWaitlistPreorderDecline(
  repository: WaitlistRepository,
  signupToken: string,
  update: PreorderDeclineUpdate,
) {
  const existing = await repository.findByToken(signupToken);
  if (!existing) return { status: "not_found" as const };
  if (
    existing.qualificationStatus !== "completed" ||
    !existing.surveyCompletedAt
  ) {
    return { status: "qualification_required" as const };
  }

  const recorded = await repository.recordPreorderDecline(existing.id, update);
  return recorded
    ? { status: "recorded" as const }
    : { status: "not_found" as const };
}
