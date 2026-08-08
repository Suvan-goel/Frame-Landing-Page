import type { Metadata } from "next";
import { ContributorHub } from "@/app/components/contributor-hub";

export const metadata: Metadata = {
  title: "Contributor hub | Frame",
  robots: { index: false, follow: false },
};

export default function ContributorHubPage() {
  return <ContributorHub />;
}
