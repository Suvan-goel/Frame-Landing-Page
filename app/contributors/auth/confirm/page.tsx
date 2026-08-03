import type { Metadata } from "next";
import { ContributorAuthConfirm } from "@/app/components/contributor-auth-confirm";
import { ContributorHeader } from "@/app/components/contributor-chrome";

export const metadata: Metadata = {
  title: "Signing in — Frame Founding Contributors",
  robots: { index: false, follow: false },
};

export default function ContributorAuthConfirmPage() {
  return (
    <>
      <ContributorHeader memberLink={false} />
      <ContributorAuthConfirm />
    </>
  );
}
