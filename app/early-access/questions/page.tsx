import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import {
  WaitlistQualificationFlow,
  WaitlistSignupProvider,
} from "../../components/waitlist-signup-flow";

export const metadata: Metadata = {
  title: "Help shape Frame",
  description: "Answer five short questions to help shape Frame.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EarlyAccessQuestionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string | string[] }>;
}) {
  const query = await searchParams;
  const previewSurvey = query?.preview === "1";

  return (
    <main className="interest-flow">
      <SiteHeader backLabel="Skip" arrowDirection="right" />
      <div className="interest-flow__shell">
        <WaitlistSignupProvider
          previewSurvey={previewSurvey}
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
