import type { Metadata } from "next";
import { InterestFlow } from "../components/interest-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Get updates | Frame",
    description: (await isPreorderSalesPageEnabled())
      ? "Get Frame product milestones, launch news, and opportunities to help shape the experience."
      : "Get Frame development updates and tell us what you want to understand about your blood pressure.",
    alternates: {
      canonical: "/interest",
    },
  };
}

export default async function InterestPage() {
  const [showFoundingContributorOffer, usePreorderLaunchCopy] = await Promise.all([
    isFoundingContributorSalesPageEnabled(),
    isPreorderSalesPageEnabled(),
  ]);

  return (
    <InterestFlow
      showFoundingContributorOffer={showFoundingContributorOffer}
      usePreorderLaunchCopy={usePreorderLaunchCopy}
    />
  );
}
