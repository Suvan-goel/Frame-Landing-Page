import { SiteHeader } from "./site-header";
import { headers } from "next/headers";
import { PREORDER_STAGING_EXIT_PATH } from "@/lib/preorder-staging-access";
import { PREORDER_LIVE_SMOKE_EXIT_PATH } from "@/lib/preorder-live-smoke-access";

export async function PreorderHeader({
  backHref = "/",
  backLabel = "Back to home",
  historyBack = false,
}: {
  backHref?: string;
  backLabel?: string;
  historyBack?: boolean;
}) {
  const requestHeaders = await headers();
  const privateStaging =
    requestHeaders.get("x-frame-preorder-staging-request") === "1";
  const privateLiveSmoke =
    requestHeaders.get("x-frame-preorder-live-smoke-request") === "1";
  return (
    <>
      {privateStaging ? (
        <div className="preorder-test-banner" role="note">
          Private staging · Stripe test mode · no live charge ·{" "}
          <a href={PREORDER_STAGING_EXIT_PATH}>Leave staging</a>
        </div>
      ) : null}
      {privateLiveSmoke ? (
        <div className="preorder-test-banner preorder-live-smoke-banner" role="alert">
          Private live verification · real card charge · one-unit limit ·{" "}
          <a href={PREORDER_LIVE_SMOKE_EXIT_PATH}>Leave verification</a>
        </div>
      ) : null}
      <SiteHeader
        backHref={backHref}
        backLabel={backLabel}
        historyBack={historyBack}
      />
    </>
  );
}
