import type { Metadata } from "next";
import { InterestFlow } from "../components/interest-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";

export const metadata: Metadata = {
  title: "Register your interest — Frame",
  description:
    "Tell Frame what you want to understand about your blood pressure and register for early access.",
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
