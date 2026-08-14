import type {
  NewWaitlistRecord,
  QualificationUpdate,
  WaitlistRecordState,
  WaitlistRepository,
} from "./waitlist-service.server";

type PreviewWaitlistRecord = WaitlistRecordState & {
  email: string;
  signup: NewWaitlistRecord;
  qualification: QualificationUpdate | null;
  preorderDecline: {
    reason: string;
    detail: string | null;
    recordedAt: string;
  } | null;
  skippedAt: string | null;
};

const previewRecords = new Map<string, PreviewWaitlistRecord>();
let nextPreviewId = 1;

function recordByToken(signupToken: string) {
  return Array.from(previewRecords.values()).find(
    (record) => record.signupToken === signupToken,
  ) ?? null;
}

export function getWaitlistPreviewRepository(): WaitlistRepository {
  return {
    async findByEmail(email) {
      return previewRecords.get(email) ?? null;
    },
    async insert(input) {
      if (previewRecords.has(input.email)) {
        throw Object.assign(new Error("Duplicate preview email"), {
          code: "23505",
        });
      }
      const record: PreviewWaitlistRecord = {
        id: nextPreviewId++,
        email: input.email,
        signupToken: crypto.randomUUID(),
        metaEventId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        qualificationStatus: "not_started",
        surveyCompletedAt: null,
        signup: input,
        qualification: null,
        preorderDecline: null,
        skippedAt: null,
      };
      previewRecords.set(input.email, record);
      return record;
    },
    async resubscribe() {
      // Preview records do not persist an unsubscribe preference.
    },
    async findByToken(signupToken) {
      return recordByToken(signupToken);
    },
    async findMetaLeadByEventId(metaEventId) {
      const record = Array.from(previewRecords.values()).find(
        (candidate) => candidate.metaEventId === metaEventId,
      );
      return record
        ? {
            metaEventId: record.metaEventId,
            email: record.email,
            metaClickId: record.signup.metaClickId,
            createdAt: record.createdAt,
            metaCapiStatus: "not_attempted",
          }
        : null;
    },
    async updateMetaTrackingDiagnostics() {
      // Preview diagnostics intentionally remain in memory only.
    },
    async markSkipped(id, skippedAt) {
      const record = Array.from(previewRecords.values()).find(
        (candidate) => candidate.id === id,
      );
      if (!record || record.qualificationStatus === "completed") return;
      record.qualificationStatus = "skipped";
      record.skippedAt = skippedAt;
    },
    async completeIfIncomplete(id, update) {
      const record = Array.from(previewRecords.values()).find(
        (candidate) => candidate.id === id,
      );
      if (
        !record ||
        record.qualificationStatus === "completed" ||
        record.surveyCompletedAt
      ) {
        return false;
      }
      record.qualificationStatus = "completed";
      record.surveyCompletedAt = update.completedAt;
      record.qualification = update;
      return true;
    },
    async recordPreorderDecline(id, update) {
      const record = Array.from(previewRecords.values()).find(
        (candidate) => candidate.id === id,
      );
      if (!record) return false;
      record.preorderDecline = update;
      return true;
    },
  };
}
