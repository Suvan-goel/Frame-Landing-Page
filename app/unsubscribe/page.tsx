import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { UnsubscribeControl } from "@/app/components/unsubscribe-control";

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

  return (
    <main className="legal-page unsubscribe-page">
      <div className="legal-shell unsubscribe-shell">
        <Link className="wordmark" href="/" aria-label="Frame home">
          <BrandWordmark />
        </Link>
        <p className="eyebrow">Email preferences</p>
        <h1>Stop Frame development updates?</h1>
        <p className="legal-intro">
          Confirm below and we’ll remove this address from future development and
          product-update emails.
        </p>
        <UnsubscribeControl token={token} />
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
