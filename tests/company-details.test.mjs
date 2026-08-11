import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMPANY_DETAILS,
  COMPANY_DETAILS_CHECK,
  COMPANY_DETAILS_COMPLETE,
  COMPANY_INCORPORATION_DETAILS_CHECK,
  COMPANY_INCORPORATION_DETAILS_COMPLETE,
  ORGANIZATION_DISPLAY_NAME,
  SUPPORT_EMAIL,
  companyLegalIdentityLine,
  evaluateCompanyDetails,
  evaluateCompanyIncorporationDetails,
  formatCorrespondenceAddress,
  formatRegisteredOffice,
} from "../lib/company.ts";
import { CONTACT_TOPICS } from "../lib/contact-topics.ts";
import { PREORDER_SELLER_DETAILS_COMPLETE } from "../lib/preorder.ts";

const completeCompany = {
  legalName: "Frame Health Technologies, Inc.",
  registrationNumber: "1234567",
  registeredOffice: {
    line1: "123 Example Street",
    line2: "Suite 400",
    locality: "Wilmington",
    region: "Delaware",
    postalCode: "19801",
    country: "United States",
  },
  correspondenceAddress: {
    line1: "2810 N Church St",
    line2: "STE 89620",
    locality: "Wilmington",
    region: "Delaware",
    postalCode: "19802",
    country: "United States",
  },
  correspondenceAddressAuthorized: true,
  jurisdiction: "Delaware, United States",
  supportEmail: "support@framewearable.com",
  warrantyProviderName: "Frame Health Technologies, Inc.",
  privacyControllerName: "Frame Health Technologies, Inc.",
};

test("records the confirmed incorporation and authorised Stable correspondence address", () => {
  assert.equal(COMPANY_INCORPORATION_DETAILS_COMPLETE, true);
  assert.equal(COMPANY_INCORPORATION_DETAILS_CHECK.complete, true);
  assert.equal(COMPANY_DETAILS_COMPLETE, true);
  assert.equal(PREORDER_SELLER_DETAILS_COMPLETE, true);
  assert.equal(COMPANY_DETAILS_CHECK.complete, true);
  assert.deepEqual(COMPANY_DETAILS_CHECK.missingOrInvalid, []);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("supportEmail"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("legalName"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("registrationNumber"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("registeredOffice.line1"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("correspondenceAddress.line1"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("correspondenceAddressAuthorized"), false);
  assert.equal(COMPANY_DETAILS_CHECK.missingOrInvalid.includes("jurisdiction"), false);
  assert.equal(COMPANY_DETAILS.legalName, "Frame Wearable, Inc.");
  assert.equal(COMPANY_DETAILS.registrationNumber, "10728944");
  assert.equal(COMPANY_DETAILS.jurisdiction, "Delaware, United States");
  assert.equal(
    formatRegisteredOffice(),
    "131 Continental Dr, Suite 305, Newark, Delaware, 19713, United States",
  );
  assert.equal(
    formatCorrespondenceAddress(),
    "2810 N Church St, STE 89620, Wilmington, Delaware, 19802, United States",
  );
  assert.equal(
    companyLegalIdentityLine(),
    "Frame Wearable, Inc. · Registration 10728944 · Registered in Delaware, United States · Registered office: 131 Continental Dr, Suite 305, Newark, Delaware, 19713, United States · Customer correspondence: 2810 N Church St, STE 89620, Wilmington, Delaware, 19802, United States",
  );
  assert.equal(ORGANIZATION_DISPLAY_NAME, COMPANY_DETAILS.legalName);
  assert.equal(SUPPORT_EMAIL, COMPANY_DETAILS.supportEmail);
});

test("routes each contact-form topic to the intended support alias", () => {
  assert.deepEqual(
    Object.fromEntries(CONTACT_TOPICS.map(({ value, recipient }) => [value, recipient])),
    {
      general: "support@framewearable.com",
      preorder: "preorders@framewearable.com",
      research: "research@framewearable.com",
      partnerships: "partnerships@framewearable.com",
      privacy: "privacy@framewearable.com",
      other: "support@framewearable.com",
    },
  );
});

test("accepts one complete identity and formats it consistently", () => {
  assert.deepEqual(evaluateCompanyIncorporationDetails(completeCompany), {
    complete: true,
    missingOrInvalid: [],
  });
  const result = evaluateCompanyDetails(completeCompany);
  assert.deepEqual(result, { complete: true, missingOrInvalid: [] });
  assert.equal(
    formatRegisteredOffice(completeCompany.registeredOffice),
    "123 Example Street, Suite 400, Wilmington, Delaware, 19801, United States",
  );
  assert.equal(
    formatCorrespondenceAddress(completeCompany.correspondenceAddress),
    "2810 N Church St, STE 89620, Wilmington, Delaware, 19802, United States",
  );
  assert.equal(
    companyLegalIdentityLine(completeCompany),
    "Frame Health Technologies, Inc. · Registration 1234567 · Registered in Delaware, United States · Registered office: 123 Example Street, Suite 400, Wilmington, Delaware, 19801, United States · Customer correspondence: 2810 N Church St, STE 89620, Wilmington, Delaware, 19802, United States",
  );
});

test("requires a complete, authorised correspondence address", () => {
  const unauthorised = evaluateCompanyDetails({
    ...completeCompany,
    correspondenceAddressAuthorized: false,
  });
  assert.equal(unauthorised.complete, false);
  assert.equal(
    unauthorised.missingOrInvalid.includes("correspondenceAddressAuthorized"),
    true,
  );

  const incomplete = evaluateCompanyDetails({
    ...completeCompany,
    correspondenceAddress: {
      ...completeCompany.correspondenceAddress,
      postalCode: "",
    },
  });
  assert.equal(incomplete.complete, false);
  assert.equal(
    incomplete.missingOrInvalid.includes("correspondenceAddress.postalCode"),
    true,
  );
});

test("rejects placeholders and inconsistent controller or warranty identities", () => {
  const placeholder = evaluateCompanyDetails({
    ...completeCompany,
    legalName: "[LEGAL NAME TO BE CONFIRMED]",
    warrantyProviderName: "[LEGAL NAME TO BE CONFIRMED]",
    privacyControllerName: "[LEGAL NAME TO BE CONFIRMED]",
  });
  assert.equal(placeholder.complete, false);
  assert.equal(placeholder.missingOrInvalid.includes("legalName"), true);

  const mismatch = evaluateCompanyDetails({
    ...completeCompany,
    warrantyProviderName: "Different Warranty Company",
    privacyControllerName: "Different Privacy Company",
  });
  assert.equal(mismatch.complete, false);
  assert.equal(mismatch.missingOrInvalid.includes("warrantyProviderName"), true);
  assert.equal(mismatch.missingOrInvalid.includes("privacyControllerName"), true);
});

test("wires the same company source through policies, support, emails, and launch checks", async () => {
  const files = await Promise.all(
    [
      "../app/preorder/terms/page.tsx",
      "../app/preorder/refunds/page.tsx",
      "../app/preorder/product-status/page.tsx",
      "../app/privacy/page.tsx",
      "../app/api/contact/route.ts",
      "../lib/preorder-email.server.ts",
      "../lib/transactional-email-design.ts",
      "../lib/preorder-launch-readiness.server.ts",
      "../lib/preorder-email-readiness.ts",
      "../lib/resend-mailing.server.ts",
      "../app/components/structured-data.tsx",
      "../app/components/preorder-checkout-review.tsx",
      "../app/page.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const [
    terms,
    refunds,
    productStatus,
    privacy,
    contact,
    email,
    emailDesign,
    readiness,
    emailReadiness,
    mailing,
    structuredData,
    checkoutReview,
    homepage,
  ] = files;

  assert.match(terms, /COMPANY_DETAILS\.legalName/);
  assert.match(terms, /COMPANY_DETAILS\.warrantyProviderName/);
  assert.match(terms, /formatCorrespondenceAddress/);
  assert.match(refunds, /formatRegisteredOffice/);
  assert.match(refunds, /formatCorrespondenceAddress/);
  assert.match(productStatus, /COMPANY_DETAILS\.jurisdiction/);
  assert.match(productStatus, /formatCorrespondenceAddress/);
  assert.match(privacy, /COMPANY_DETAILS\.privacyControllerName/);
  assert.match(privacy, /formatCorrespondenceAddress/);
  assert.match(contact, /const topicConfig = getContactTopic\(topic\)/);
  assert.match(contact, /to: \[topicConfig\.recipient\]/);
  assert.match(email, /companyLegalIdentityLine/);
  assert.match(emailDesign, /companyLegalIdentityLine/);
  assert.match(readiness, /COMPANY_DETAILS_CHECK\.missingOrInvalid/);
  assert.match(readiness, /operationsRecipient[\s\S]+PREORDER_EMAIL_REPLY_TO/);
  assert.match(emailReadiness, /SUPPORT_EMAIL/);
  assert.match(mailing, /formatCorrespondenceAddress/);
  assert.match(structuredData, /COMPANY_DETAILS\.correspondenceAddress/);
  assert.match(checkoutReview, /companyLegalIdentityLine/);
  assert.match(homepage, /companyLegalIdentityLine/);

  for (const source of files) {
    assert.doesNotMatch(source, /support@framewearable\.com/);
  }
});
