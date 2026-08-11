export type PostalAddress = {
  line1: string;
  line2: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

export type RegisteredOffice = PostalAddress;

export type CompanyDetails = {
  legalName: string;
  registrationNumber: string;
  registeredOffice: RegisteredOffice;
  correspondenceAddress: PostalAddress;
  correspondenceAddressAuthorized: boolean;
  jurisdiction: string;
  supportEmail: string;
  warrantyProviderName: string;
  privacyControllerName: string;
};

export const PUBLIC_BRAND_NAME = "Frame Health Technologies";

// The incorporation values below match the Delaware formation record dated
// August 10, 2026 and the signed Certificate of Incorporation. Add the
// separately authorised public correspondence address only after the mail
// provider has approved the incorporated company as a recipient. Stable shows
// the address-authorisation task complete and Frame Wearable, Inc. as an active
// business recipient. The warranty provider and privacy controller deliberately
// derive from the legal name so they cannot drift.
const incorporatedLegalName = "Frame Wearable, Inc.";

export const COMPANY_DETAILS: Readonly<CompanyDetails> = Object.freeze({
  legalName: incorporatedLegalName,
  registrationNumber: "10728944",
  registeredOffice: Object.freeze({
    line1: "131 Continental Dr",
    line2: "Suite 305",
    locality: "Newark",
    region: "Delaware",
    postalCode: "19713",
    country: "United States",
  }),
  correspondenceAddress: Object.freeze({
    line1: "2810 N Church St",
    line2: "STE 89620",
    locality: "Wilmington",
    region: "Delaware",
    postalCode: "19802",
    country: "United States",
  }),
  correspondenceAddressAuthorized: true,
  jurisdiction: "Delaware, United States",
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

export function evaluateCompanyIncorporationDetails(
  details: CompanyDetails = COMPANY_DETAILS,
): CompanyDetailsCheck {
  const missingOrInvalid: string[] = [];
  const requiredText: Array<[string, string]> = [
    ["legalName", details.legalName],
    ["registrationNumber", details.registrationNumber],
    ["registeredOffice.line1", details.registeredOffice.line1],
    ["registeredOffice.locality", details.registeredOffice.locality],
    ["registeredOffice.region", details.registeredOffice.region],
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

export function evaluateCompanyDetails(
  details: CompanyDetails = COMPANY_DETAILS,
): CompanyDetailsCheck {
  const incorporationCheck = evaluateCompanyIncorporationDetails(details);
  const missingOrInvalid = [...incorporationCheck.missingOrInvalid];
  const requiredCorrespondenceText: Array<[string, string]> = [
    ["correspondenceAddress.line1", details.correspondenceAddress.line1],
    ["correspondenceAddress.locality", details.correspondenceAddress.locality],
    ["correspondenceAddress.region", details.correspondenceAddress.region],
    ["correspondenceAddress.postalCode", details.correspondenceAddress.postalCode],
    ["correspondenceAddress.country", details.correspondenceAddress.country],
  ];

  for (const [field, value] of requiredCorrespondenceText) {
    if (!isCompleteText(value)) missingOrInvalid.push(field);
  }
  if (!details.correspondenceAddressAuthorized) {
    missingOrInvalid.push("correspondenceAddressAuthorized");
  }

  return {
    complete: missingOrInvalid.length === 0,
    missingOrInvalid: [...new Set(missingOrInvalid)],
  };
}

export const COMPANY_INCORPORATION_DETAILS_CHECK =
  evaluateCompanyIncorporationDetails();
export const COMPANY_INCORPORATION_DETAILS_COMPLETE =
  COMPANY_INCORPORATION_DETAILS_CHECK.complete;
export const COMPANY_DETAILS_CHECK = evaluateCompanyDetails();
export const COMPANY_DETAILS_COMPLETE = COMPANY_DETAILS_CHECK.complete;
export const SUPPORT_EMAIL = COMPANY_DETAILS.supportEmail;
export const ORGANIZATION_DISPLAY_NAME = COMPANY_DETAILS_COMPLETE
  ? COMPANY_DETAILS.legalName
  : PUBLIC_BRAND_NAME;

export function formatPostalAddress(address: PostalAddress) {
  return [
    address.line1,
    address.line2,
    address.locality,
    address.region,
    address.postalCode,
    address.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatRegisteredOffice(
  office: RegisteredOffice = COMPANY_DETAILS.registeredOffice,
) {
  return formatPostalAddress(office);
}

export function formatCorrespondenceAddress(
  address: PostalAddress = COMPANY_DETAILS.correspondenceAddress,
) {
  return formatPostalAddress(address);
}

export function companyLegalIdentityLine(
  details: CompanyDetails = COMPANY_DETAILS,
) {
  if (!evaluateCompanyDetails(details).complete) return null;
  return `${details.legalName} · Registration ${details.registrationNumber} · Registered in ${details.jurisdiction} · Registered office: ${formatRegisteredOffice(details.registeredOffice)} · Customer correspondence: ${formatCorrespondenceAddress(details.correspondenceAddress)}`;
}
