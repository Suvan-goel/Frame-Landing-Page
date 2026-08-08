import type { Metadata } from "next";
import { ContributorHeader } from "@/app/components/contributor-chrome";
import { ContributorSignIn } from "@/app/components/contributor-sign-in";

export const metadata: Metadata = {
  title: "Member sign in | Frame Founding Contributors",
  robots: { index: false, follow: false },
};

export default function ContributorSignInPage() {
  return (
    <>
      <ContributorHeader memberLink={false} />
      <ContributorSignIn />
    </>
  );
}
