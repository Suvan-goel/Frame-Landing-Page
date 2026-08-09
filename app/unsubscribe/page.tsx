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
  searchParams?: Promise<{ token?: string | string[] }>;
}) {
  const rawToken = (await searchParams)?.token;
  const token = typeof rawToken === "string" ? rawToken : "";
  const usePreorderLaunchCopy = await isPreorderSalesPageEnabled();

  return (
    <main className="legal-page unsubscribe-page">
      <div className="legal-shell unsubscribe-shell">
        <Link className="wordmark" href="/" aria-label="Frame home">
          <BrandWordmark />
        </Link>
        <p className="eyebrow">Email preferences</p>
        <h1>
          {usePreorderLaunchCopy
            ? "Stop Frame updates?"
            : "Stop Frame development updates?"}
        </h1>
        <p className="legal-intro">
          {usePreorderLaunchCopy
            ? "Confirm below and we’ll remove this address from future product and launch-update emails."
            : "Confirm below and we’ll remove this address from future development and product-update emails."}
        </p>
        <UnsubscribeControl
          token={token}
          usePreorderLaunchCopy={usePreorderLaunchCopy}
        />
        <p className="unsubscribe-note">
          This does not affect essential messages about an active order or paid
          membership. If you clicked by mistake, no change has been made yet.
        </p>
        <Link className="text-link" href="/">
          <span aria-hidden="true">←</span> Back to Frame
        </Link>
      </div>
    </main>
  );
}
