import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import {
  WaitlistQualificationFlow,
  WaitlistSignupProvider,
} from "../../components/waitlist-signup-flow";
import { isEmailFirstWaitlistEnabled } from "@/lib/waitlist-flow.server";

export const metadata: Metadata = {
  title: "Help shape Frame",
  description: "Answer three optional questions to help shape Frame.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EarlyAccessQuestionsPage() {
  if (!(await isEmailFirstWaitlistEnabled())) notFound();

  return (
    <main className="interest-flow">
      <SiteHeader />
      <div className="interest-flow__shell">
        <WaitlistSignupProvider
          resumeSurvey
          resumePlacement="qualification_page"
        >
          <WaitlistQualificationFlow
            placement="qualification_page"
            finishHref="/"
          />
        </WaitlistSignupProvider>
      </div>
    </main>
  );
}
