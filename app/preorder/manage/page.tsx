import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderHeader } from "@/app/components/preorder-chrome";
import { PreorderManage } from "@/app/components/preorder-manage";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Manage your Frame pre-order",
  description: "Review your Frame pre-order, update contact and delivery details, respond to timing changes, or request cancellation.",
  alternates: { canonical: "/preorder/manage" },
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderManagePage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="preorder-manage-page">
      <PreorderHeader backHref="/" backLabel="Back to Frame" />
      <PreorderManage />
    </main>
  );
}
