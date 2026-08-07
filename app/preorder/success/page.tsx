import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreorderHeader } from "../../components/preorder-chrome";
import { PreorderSuccess } from "../../components/preorder-success";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Your Frame pre-order is confirmed",
  description: "Your Frame pre-order confirmation and estimated shipping details.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PreorderSuccessPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  return (
    <main className="contributor-success-page preorder-success-page">
      <PreorderHeader backHref="/" backLabel="Back to home" />
      <PreorderSuccess />
    </main>
  );
}
