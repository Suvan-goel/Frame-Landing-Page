import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Contributor profile — Frame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ContributorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const query = await searchParams;
  redirect(
    query.preview === "1"
      ? "/contributors?preview=1&section=profile"
      : "/contributors?section=profile",
  );
}
