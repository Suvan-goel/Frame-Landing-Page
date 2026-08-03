import type { ContributorDashboard } from "./contributor-types";
import { getRoadmapStageStatus, roadmapStages } from "./contributor-membership";

const now = new Date();
const paidAt = new Date(now);
paidAt.setUTCDate(paidAt.getUTCDate() - 12);
const accessExpiresAt = new Date(paidAt);
accessExpiresAt.setUTCFullYear(accessExpiresAt.getUTCFullYear() + 1);
const nextBriefing = new Date(now);
nextBriefing.setUTCDate(nextBriefing.getUTCDate() + 19);
nextBriefing.setUTCHours(17, 0, 0, 0);
const voteClosesAt = new Date(now);
voteClosesAt.setUTCDate(voteClosesAt.getUTCDate() + 10);

export const contributorPreviewDashboard: ContributorDashboard = {
  membership: {
    id: "preview-contributor",
    email: "founder@example.com",
    fullName: "Alex Morgan",
    preferredName: "Alex",
    contributorNumber: 27,
    membershipStatus: "active",
    paidAt: paidAt.toISOString(),
    accessStartsAt: paidAt.toISOString(),
    accessExpiresAt: accessExpiresAt.toISOString(),
    amountPaidCents: 9_900,
    currency: "usd",
    futureDiscountEligible: true,
    termsVersion: "draft-2026-08-03-v1",
    onboardingCompletedAt: paidAt.toISOString(),
  },
  profile: {
    preferredName: "Alex",
    country: "United Kingdom",
    learningGoal: "Understand the development decisions and give useful feedback on the everyday experience.",
    productAreas: ["comfort", "app_experience", "development_updates"],
    foundersWallOptIn: true,
  },
  updates: [
    {
      id: "briefing-01",
      title: "Development briefing 01 — proving the signal",
      summary:
        "The first phase is about learning whether the proposed ultrasound approach can capture a repeatable arterial signal before wearability work begins.",
      body:
        "Frame is beginning with benchtop sensing experiments, signal-quality criteria, and a measurement protocol. The immediate goal is not a wearable device or a medical conclusion. It is to establish what can be observed reliably, what interferes with the signal, and which questions should be tested next.",
      publishedAt: paidAt.toISOString(),
      category: "Technical update",
    },
    {
      id: "community-note-01",
      title: "How the contributor programme will work",
      summary:
        "A practical guide to monthly updates, weekly questions, advisory votes, briefings, and research invitations.",
      body:
        "Updates will document what was attempted, what was learned, and where uncertainty remains. Questions are collected throughout the week and answered asynchronously. Votes are advisory and will always state the decision they can inform.",
      publishedAt: paidAt.toISOString(),
      category: "Community",
    },
  ],
  questions: [
    {
      id: "question-01",
      question: "What has to be true before Frame starts testing an integrated wearable prototype?",
      answer:
        "The sensing approach first needs to show repeatable signal capture under controlled conditions. Only then does it make sense to invest in miniaturisation, enclosure work, and longer wearability studies.",
      submittedAt: paidAt.toISOString(),
      answeredAt: paidAt.toISOString(),
      askedBy: "Founding Contributor 0012",
    },
  ],
  events: [
    {
      id: "event-01",
      title: "Founding Contributor briefing — the first 90 days",
      description:
        "A live walkthrough of the initial technical plan, measurement questions, and how contributor feedback will be used.",
      startsAt: nextBriefing.toISOString(),
      eventUrl: null,
      recordingUrl: null,
    },
  ],
  votes: [
    {
      id: "vote-01",
      title: "Which development detail should the next briefing explain most deeply?",
      description:
        "This vote is advisory. Results will guide the emphasis of the next update but do not guarantee a particular engineering decision.",
      options: [
        { id: "signal", label: "Signal quality and confidence" },
        { id: "comfort", label: "Wearability and comfort" },
        { id: "validation", label: "Measurement validation" },
      ],
      closesAt: voteClosesAt.toISOString(),
      selectedOptionId: null,
    },
  ],
  research: [
    {
      id: "research-01",
      title: "Contributor welcome interview",
      description:
        "A 25-minute conversation about what you hope to learn from Frame and how development updates can be made more useful.",
      eligibility: "Open to adult Founding Contributors. No medical information is requested.",
      applyUrl: null,
    },
  ],
  roadmap: roadmapStages.map(([label, title]) => ({
    label,
    title,
    status: getRoadmapStageStatus(label),
  })),
};
