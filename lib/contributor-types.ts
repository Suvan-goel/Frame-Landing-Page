export type ContributorMembership = {
  id: string;
  email: string;
  fullName: string;
  preferredName: string | null;
  contributorNumber: number;
  membershipStatus: "active" | "expired" | "refunded" | "disputed";
  paidAt: string;
  accessStartsAt: string;
  accessExpiresAt: string;
  amountPaidCents: number;
  currency: string;
  futureDiscountEligible: boolean;
  termsVersion: string;
  onboardingCompletedAt: string | null;
};

export type ContributorUpdate = {
  id: string;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
  category: string;
};

export type ContributorQuestion = {
  id: string;
  question: string;
  answer: string | null;
  submittedAt: string;
  answeredAt: string | null;
  askedBy: string;
};

export type ContributorEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  eventUrl: string | null;
  recordingUrl: string | null;
};

export type ContributorVote = {
  id: string;
  title: string;
  description: string;
  options: Array<{ id: string; label: string }>;
  closesAt: string;
  selectedOptionId: string | null;
};

export type ContributorResearchOpportunity = {
  id: string;
  title: string;
  description: string;
  eligibility: string;
  applyUrl: string | null;
};

export type ContributorDashboard = {
  membership: ContributorMembership;
  updates: ContributorUpdate[];
  questions: ContributorQuestion[];
  events: ContributorEvent[];
  votes: ContributorVote[];
  research: ContributorResearchOpportunity[];
  roadmap: Array<{ label: string; title: string; status: "completed" | "current" | "proposed" }>;
};
