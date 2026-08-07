import { SiteHeader } from "./site-header";
import { headers } from "next/headers";
import { PREORDER_STAGING_EXIT_PATH } from "@/lib/preorder-staging-access";

export async function PreorderHeader({
  backHref = "/",
  backLabel = "Back to home",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const requestHeaders = await headers();
  const privateStaging =
    requestHeaders.get("x-frame-preorder-staging-request") === "1";
  return (
    <>
      {privateStaging ? (
        <div className="preorder-test-banner" role="note">
          Private staging · Stripe test mode · no live charge ·{" "}
          <a href={PREORDER_STAGING_EXIT_PATH}>Leave staging</a>
        </div>
      ) : null}
      <SiteHeader
        backHref={backHref}
        backLabel={backLabel}
        links={[{ href: "/preorder/terms", label: "Pre-order terms" }]}
      />
    </>
  );
}
