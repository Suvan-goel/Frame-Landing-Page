import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { UnsubscribeControl } from "@/app/components/unsubscribe-control";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const metadata: Metadata = {
  title: "Email preferences | Frame",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{
    token?: string | string[];
    preview?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawToken = query?.token;
  const token = typeof rawToken === "string" ? rawToken : "";
  const previewSuccess = query?.preview === "success";
  const usePreorderLaunchCopy = await isPreorderSalesPageEnabled();

  return (
    <main className="legal-page unsubscribe-page">
      <div className="legal-shell unsubscribe-shell">
        <header className="unsubscribe-header">
          <Link className="wordmark" href="/" aria-label="Frame home">
            <BrandWordmark />
          </Link>
          <Link className="text-link" href="/">
            <span aria-hidden="true">←</span> Back to Frame
          </Link>
        </header>
        <UnsubscribeControl
          token={token}
          usePreorderLaunchCopy={usePreorderLaunchCopy}
          previewSuccess={previewSuccess}
        />
      </div>
    </main>
  );
}
