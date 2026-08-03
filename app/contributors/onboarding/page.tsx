import type { Metadata } from "next";
import { ContributorHeader } from "@/app/components/contributor-chrome";
import { ContributorOnboarding } from "@/app/components/contributor-onboarding";

export const metadata: Metadata = {
  title: "Contributor onboarding — Frame",
  robots: { index: false, follow: false },
};

export default function ContributorOnboardingPage() {
  return (
    <>
      <ContributorHeader backHref="/contributors" backLabel="Back to hub" memberLink={false} />
      <ContributorOnboarding />
    </>
  );
}
