import type { Metadata } from "next";
import { InterestFlow } from "../components/interest-flow";
import { InterestFlow as LegacyInterestFlow } from "../components/legacy-interest-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { isEmailFirstWaitlistEnabled } from "@/lib/waitlist-flow.server";

export const metadata: Metadata = {
  title: "Register your interest — Frame",
  description:
    "Tell Frame what you want to understand about your blood pressure and register for early access.",
  alternates: {
    canonical: "/interest",
  },
};

export default async function InterestPage() {
  const [showFoundingContributorOffer, showEmailFirstWaitlist] =
    await Promise.all([
      isFoundingContributorSalesPageEnabled(),
      isEmailFirstWaitlistEnabled(),
    ]);

  return showEmailFirstWaitlist ? (
    <InterestFlow
      showFoundingContributorOffer={showFoundingContributorOffer}
    />
  ) : (
    <LegacyInterestFlow
      showFoundingContributorOffer={showFoundingContributorOffer}
    />
  );
}
