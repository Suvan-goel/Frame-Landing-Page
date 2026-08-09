export type RegisteredOffice = {
  line1: string;
  line2: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

export type CompanyDetails = {
  legalName: string;
  registrationNumber: string;
  registeredOffice: RegisteredOffice;
  jurisdiction: string;
  supportEmail: string;
  warrantyProviderName: string;
  privacyControllerName: string;
};

export const PUBLIC_BRAND_NAME = "Frame Health Technologies";

// Complete these values from the issued incorporation documents, then bump the
// pre-order legal-pack versions for review. The warranty provider and privacy
// controller deliberately derive from the same legal name so they cannot drift.
const incorporatedLegalName = "";

export const COMPANY_DETAILS: Readonly<CompanyDetails> = Object.freeze({
  legalName: incorporatedLegalName,
  registrationNumber: "",
  registeredOffice: Object.freeze({
    line1: "",
    line2: "",
    locality: "",
    region: "",
    postalCode: "",
    country: "",
  }),
  jurisdiction: "",
  supportEmail: "support@framewearable.com",
  warrantyProviderName: incorporatedLegalName,
  privacyControllerName: incorporatedLegalName,
});

const PLACEHOLDER_VALUE =
  /\[[^\]]+\]|\b(?:pending|placeholder|tbc|tbd|to be confirmed|to be inserted|unknown|n\/a)\b/i;

function isCompleteText(value: string, minimumLength = 2) {
  const normalized = value.trim();
  return normalized.length >= minimumLength && !PLACEHOLDER_VALUE.test(normalized);
}

function isSupportEmail(value: string) {
  const normalized = value.trim();
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    !PLACEHOLDER_VALUE.test(normalized)
  );
}

export type CompanyDetailsCheck = {
  complete: boolean;
  missingOrInvalid: string[];
};

export function evaluateCompanyDetails(
  details: CompanyDetails = COMPANY_DETAILS,
): CompanyDetailsCheck {
  const missingOrInvalid: string[] = [];
  const requiredText: Array<[keyof CompanyDetails | `registeredOffice.${keyof RegisteredOffice}`, string]> = [
    ["legalName", details.legalName],
    ["registrationNumber", details.registrationNumber],
    ["registeredOffice.line1", details.registeredOffice.line1],
    ["registeredOffice.locality", details.registeredOffice.locality],
    ["registeredOffice.postalCode", details.registeredOffice.postalCode],
    ["registeredOffice.country", details.registeredOffice.country],
    ["jurisdiction", details.jurisdiction],
    ["warrantyProviderName", details.warrantyProviderName],
    ["privacyControllerName", details.privacyControllerName],
  ];

  for (const [field, value] of requiredText) {
    if (!isCompleteText(value)) missingOrInvalid.push(field);
  }
  if (!isSupportEmail(details.supportEmail)) {
    missingOrInvalid.push("supportEmail");
  }
  if (
    details.legalName.trim() &&
    details.warrantyProviderName.trim() !== details.legalName.trim()
  ) {
    missingOrInvalid.push("warrantyProviderName");
  }
  if (
    details.legalName.trim() &&
    details.privacyControllerName.trim() !== details.legalName.trim()
  ) {
    missingOrInvalid.push("privacyControllerName");
  }

  return {
    complete: missingOrInvalid.length === 0,
    missingOrInvalid: [...new Set(missingOrInvalid)],
  };
}

export const COMPANY_DETAILS_CHECK = evaluateCompanyDetails();
export const COMPANY_DETAILS_COMPLETE = COMPANY_DETAILS_CHECK.complete;
export const SUPPORT_EMAIL = COMPANY_DETAILS.supportEmail;
export const ORGANIZATION_DISPLAY_NAME = COMPANY_DETAILS_COMPLETE
  ? COMPANY_DETAILS.legalName
  : PUBLIC_BRAND_NAME;

export function formatRegisteredOffice(
  office: RegisteredOffice = COMPANY_DETAILS.registeredOffice,
) {
  return [
    office.line1,
    office.line2,
    office.locality,
    office.region,
    office.postalCode,
    office.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function companyLegalIdentityLine(
  details: CompanyDetails = COMPANY_DETAILS,
) {
  if (!evaluateCompanyDetails(details).complete) return null;
  return `${details.legalName} · Registration ${details.registrationNumber} · Registered in ${details.jurisdiction} · ${formatRegisteredOffice(details.registeredOffice)}`;
}
