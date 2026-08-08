import type { Metadata } from "next";
import { ContributorSuccess } from "../../components/contributor-success";
import { ContributorHeader } from "../../components/contributor-chrome";

export const metadata: Metadata = {
  title: "Founding Contributor membership | Frame",
  description: "Frame Founding Contributor membership confirmation.",
  robots: { index: false, follow: false },
};

export default function ContributorSuccessPage() {
  return (
    <main className="contributor-success-page">
      <ContributorHeader memberLink={false} />
      <ContributorSuccess />
    </main>
  );
}
