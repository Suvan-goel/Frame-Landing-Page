import type { Metadata } from "next";
import { PreorderHeader } from "@/app/components/preorder-chrome";
import { PreorderManage } from "@/app/components/preorder-manage";

export const metadata: Metadata = {
  title: "Manage your Frame pre-order",
  description: "View the latest status or request cancellation of your Frame pre-order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PreorderManagePage() {
  return (
    <main className="preorder-manage-page">
      <PreorderHeader backHref="/" backLabel="Back to Frame" />
      <PreorderManage />
    </main>
  );
}
