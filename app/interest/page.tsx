import type { Metadata } from "next";
import { InterestFlow } from "../components/interest-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";

export const metadata: Metadata = {
  title: "Get updates — Frame",
  description:
    "Get Frame development updates and tell us what you want to understand about your blood pressure.",
  alternates: {
    canonical: "/interest",
  },
};

export default async function InterestPage() {
  return (
    <InterestFlow
      showFoundingContributorOffer={
        await isFoundingContributorSalesPageEnabled()
      }
    />
  );
}
