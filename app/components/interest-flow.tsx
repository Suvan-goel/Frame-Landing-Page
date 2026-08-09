"use client";

import { SiteHeader } from "./site-header";
import {
  WaitlistSignupFlow,
  WaitlistSignupProvider,
} from "./waitlist-signup-flow";

export function InterestFlow({
  showFoundingContributorOffer,
  usePreorderLaunchCopy,
}: {
  showFoundingContributorOffer: boolean;
  usePreorderLaunchCopy: boolean;
}) {
  return (
    <WaitlistSignupProvider>
      <main className="interest-flow" aria-label="Frame updates">
        <SiteHeader />
        <div className="interest-flow__shell">
          <WaitlistSignupFlow
            placement="interest_page"
            showFoundingContributorOffer={showFoundingContributorOffer}
            finishHref="/"
            usePreorderLaunchCopy={usePreorderLaunchCopy}
          />
        </div>
      </main>
    </WaitlistSignupProvider>
  );
}
