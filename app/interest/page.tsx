import type { Metadata } from "next";
import { InterestFlow } from "../components/interest-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";

export const metadata: Metadata = {
  title: "Join Frame early access",
  description:
    "Join Frame early access with your email, then optionally help shape the product with three short questions.",
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
