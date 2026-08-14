import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import {
  WaitlistQualificationFlow,
  WaitlistSurveyHeaderAction,
  WaitlistSignupProvider,
} from "../../components/waitlist-signup-flow";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import { formatPreorderMoney } from "@/lib/preorder";

export const metadata: Metadata = {
  title: "Help shape Frame",
  description: "Answer a few short questions to help shape Frame.",
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
  const preorderEnabled = await isPreorderSalesPageEnabled();
  const preorderOffer = preorderEnabled
    ? await getPreorderConfiguration()
    : null;
  const preorderPriceLabel = preorderOffer
    ? formatPreorderMoney(preorderOffer.priceCents, preorderOffer.currency)
    : undefined;

  return (
    <main className="interest-flow">
      <WaitlistSignupProvider
        previewSurvey={previewSurvey}
        resumeSurvey
        resumePlacement="qualification_page"
      >
        <SiteHeader
          trailingAction={
            <WaitlistSurveyHeaderAction placement="qualification_page" />
          }
        />
        <div className="interest-flow__shell">
          <WaitlistQualificationFlow
            placement="qualification_page"
            finishHref="/"
            preorderHref={
              preorderOffer ? "/preorder/review?source=waitlist_survey" : undefined
            }
            preorderPriceLabel={preorderPriceLabel}
          />
        </div>
      </WaitlistSignupProvider>
    </main>
  );
}
