import type { Metadata } from "next";
import { PreorderHeader } from "@/app/components/preorder-chrome";
import { PreorderManage } from "@/app/components/preorder-manage";

export const metadata: Metadata = {
  title: "Manage your Frame pre-order",
  description: "Review your Frame pre-order, update contact and delivery details, respond to timing changes, or request cancellation.",
  alternates: { canonical: "/preorder/manage" },
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderManagePage() {
  return (
    <main className="preorder-manage-page">
      <PreorderHeader backHref="/" backLabel="Back to Frame" />
      <PreorderManage />
    </main>
  );
}
