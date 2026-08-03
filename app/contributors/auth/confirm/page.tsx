import type { Metadata } from "next";
import { ContributorAuthConfirm } from "@/app/components/contributor-auth-confirm";

export const metadata: Metadata = {
  title: "Signing in — Frame Founding Contributors",
  robots: { index: false, follow: false },
};

export default function ContributorAuthConfirmPage() {
  return <ContributorAuthConfirm />;
}
