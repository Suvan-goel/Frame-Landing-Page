export type WaitlistRecordState = {
  id: number;
  signupToken: string;
  qualificationStatus: string;
  surveyCompletedAt: string | null;
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
  primaryInterest: string;
  primaryInterestOther: string | null;
  monitoringMethod: string;
  monitoringMethodOther: string | null;
  frustration: string | null;
  researchCall: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  gender: string | null;
  completedAt: string;
};

export type WaitlistRepository = {
  findByEmail(email: string): Promise<WaitlistRecordState | null>;
  insert(input: NewWaitlistRecord): Promise<WaitlistRecordState>;
  findByToken(signupToken: string): Promise<WaitlistRecordState | null>;
  markSkipped(id: number, skippedAt: string): Promise<void>;
  completeIfIncomplete(
    id: number,
    update: QualificationUpdate,
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
    return {
      status: "already_registered" as const,
      signupToken: existing.signupToken,
      leadCreated: false,
    };
  }

  try {
    const inserted = await repository.insert(input);
    return {
      status: "joined" as const,
      signupToken: inserted.signupToken,
      leadCreated: true,
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await repository.findByEmail(input.email);
    if (!raced) throw error;
    return {
      status: "already_registered" as const,
      signupToken: raced.signupToken,
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
