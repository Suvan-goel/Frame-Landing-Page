export const CONTRIBUTOR_TERMS_VERSION = "draft-2026-08-03-v1";
export const CONTRIBUTOR_PRICE_CENTS = 9_900;
export const CONTRIBUTOR_PRICE_LABEL = "$99";
export const CONTRIBUTOR_CURRENCY = "usd";
export const CONTRIBUTOR_ACCESS_MONTHS = 12;

export const currentBenefits = [
  "12 months inside Frame’s private development community",
  "Monthly development updates with access to the full archive",
  "Weekly written Q&A with the founders",
  "Quarterly briefings, demonstrations, and recordings",
  "Advisory votes on selected product and communications decisions",
  "Priority consideration for voluntary research opportunities, subject to eligibility and consent",
  "Permanent Founding Contributor status",
  "A numbered contributor badge and optional Founders’ Wall recognition",
] as const;

export const conditionalBenefits = [
  "Priority access to purchase Frame in your region",
  "10% off at launch, up to $50",
  "Priority consideration for future product research opportunities",
] as const;

export const roadmapStages = [
  ["01", "Technical proof of concept", "Investigated whether ultrasound could capture useful arterial information."],
  ["02", "Initial measurement validation", "Tested whether captured information could support dependable blood-pressure estimation."],
  ["03", "Integrated engineering prototype", "Combining sensing, electronics, software, and data processing into a working prototype."],
  ["04", "Wearability and safety testing", "Evaluate comfort, contact quality, repeatability, motion tolerance, and safety."],
  ["05", "Regulatory readiness", "Build the evidence, quality systems, and authorization pathway for commercial release."],
  ["06", "Commercial production", "Prepare manufacturing and launch based on the completed technical and regulatory programme."],
] as const;

export const CURRENT_ROADMAP_STAGE_LABEL = "03";
export const NEXT_ROADMAP_STAGE_LABEL = String(
  Number(CURRENT_ROADMAP_STAGE_LABEL) + 1,
).padStart(2, "0");

export type RoadmapStageStatus = "completed" | "current" | "proposed";

export function getRoadmapStageStatus(label: string): RoadmapStageStatus {
  if (label === CURRENT_ROADMAP_STAGE_LABEL) return "current";

  return Number(label) < Number(CURRENT_ROADMAP_STAGE_LABEL)
    ? "completed"
    : "proposed";
}

export function addMembershipYear(date: Date) {
  const expires = new Date(date);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return expires;
}

export function formatContributorNumber(value: number | string) {
  return `FC-${String(value).padStart(4, "0")}`;
}
