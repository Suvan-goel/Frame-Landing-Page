import {
  INSTAGRAM_URL,
  ORGANIZATION_NAME,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_COMPLETE,
  SUPPORT_EMAIL,
} from "@/lib/company";

function structuredData(description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: ORGANIZATION_NAME,
      alternateName: SITE_NAME,
      url: SITE_URL,
      ...(COMPANY_DETAILS_COMPLETE
        ? {
            legalName: COMPANY_DETAILS.legalName,
            identifier: {
              "@type": "PropertyValue",
              propertyID: "Registration number",
              value: COMPANY_DETAILS.registrationNumber,
            },
            address: {
              "@type": "PostalAddress",
              streetAddress: [
                COMPANY_DETAILS.registeredOffice.line1,
                COMPANY_DETAILS.registeredOffice.line2,
              ]
                .filter(Boolean)
                .join(", "),
              addressLocality: COMPANY_DETAILS.registeredOffice.locality,
              addressRegion: COMPANY_DETAILS.registeredOffice.region,
              postalCode: COMPANY_DETAILS.registeredOffice.postalCode,
              addressCountry: COMPANY_DETAILS.registeredOffice.country,
            },
          }
        : {}),
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
      },
      sameAs: [INSTAGRAM_URL],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        url: `${SITE_URL}/contact`,
        availableLanguage: "English",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description,
      inLanguage: "en-GB",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    ],
  };
}

export function StructuredData({ description }: { description: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData(description)).replace(/</g, "\\u003c"),
      }}
    />
  );
}
