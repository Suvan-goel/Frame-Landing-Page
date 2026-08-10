import type Stripe from "stripe";
import { COMPANY_DETAILS, SUPPORT_EMAIL } from "./company";
import { SITE_URL } from "./site";

export type StripeAccountReadinessExpectation = {
  country: string;
  currency: string;
  legalName: string;
  publicWebsite: string;
  supportEmail: string;
  supportUrl: string;
};

export type StripeAccountReadinessCheck = {
  name: string;
  ready: boolean;
  readyDetail: string;
  blocker: string;
  warning?: string;
};

export type StripeAccountReadinessOptions = {
  allowBankPendingLaunch?: boolean;
};

export const STRIPE_LIVE_ACCOUNT_EXPECTATION: Readonly<StripeAccountReadinessExpectation> =
  Object.freeze({
    country: "US",
    currency: "usd",
    legalName: COMPANY_DETAILS.legalName,
    publicWebsite: SITE_URL,
    supportEmail: SUPPORT_EMAIL,
    supportUrl: `${SITE_URL}/contact`,
  });

function normalizeIdentity(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.origin}${pathname}`;
  } catch {
    return "";
  }
}

function hasFrameStatementDescriptor(value: string | null | undefined) {
  const descriptor = value?.trim() ?? "";
  return (
    descriptor.length >= 5 &&
    descriptor.length <= 22 &&
    /[a-z]/i.test(descriptor) &&
    /frame/i.test(descriptor)
  );
}

function isHexColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "");
}

function isExternalAccountRequirement(value: string | null | undefined) {
  return value === "external_account" || value?.startsWith("external_account.");
}

function requirementsWithoutExternalAccount(
  values: string[] | null | undefined,
) {
  return (values ?? []).filter((value) => !isExternalAccountRequirement(value));
}

export function evaluateStripeAccountReadiness(
  account: Stripe.Account,
  expectation: StripeAccountReadinessExpectation = STRIPE_LIVE_ACCOUNT_EXPECTATION,
  options: StripeAccountReadinessOptions = {},
): StripeAccountReadinessCheck[] {
  const requirements = account.requirements;
  const profile = account.business_profile;
  const settings = account.settings;
  const statementDescriptor =
    settings?.card_payments.statement_descriptor_prefix ??
    settings?.payments.statement_descriptor;
  const legalNameMatches =
    normalizeIdentity(expectation.legalName).length > 0 &&
    normalizeIdentity(account.company?.name) === normalizeIdentity(expectation.legalName);
  const cardPaymentsActive =
    account.charges_enabled && account.capabilities?.card_payments === "active";
  const verificationClear =
    Boolean(requirements) &&
    !requirements?.disabled_reason &&
    (requirements?.currently_due?.length ?? 0) === 0 &&
    (requirements?.past_due?.length ?? 0) === 0 &&
    (requirements?.pending_verification?.length ?? 0) === 0 &&
    (requirements?.errors?.length ?? 0) === 0;
  const explicitExternalAccountRequirement = [
    ...(requirements?.currently_due ?? []),
    ...(requirements?.past_due ?? []),
    ...(requirements?.pending_verification ?? []),
    ...(requirements?.errors ?? []).map((error) => error.requirement),
  ].some(isExternalAccountRequirement);
  const onlyBankVerificationOutstanding =
    Boolean(requirements) &&
    requirementsWithoutExternalAccount(requirements?.currently_due).length === 0 &&
    requirementsWithoutExternalAccount(requirements?.past_due).length === 0 &&
    requirementsWithoutExternalAccount(requirements?.pending_verification).length === 0 &&
    (requirements?.errors ?? []).every((error) =>
      isExternalAccountRequirement(error.requirement),
    ) &&
    (!requirements?.disabled_reason ||
      (explicitExternalAccountRequirement &&
        requirements.disabled_reason.startsWith("requirements.")));
  const bankPendingLaunchException =
    options.allowBankPendingLaunch === true &&
    cardPaymentsActive &&
    !account.payouts_enabled &&
    onlyBankVerificationOutstanding;
  const automaticPayoutSchedule =
    Boolean(settings?.payouts?.schedule.interval) &&
    settings?.payouts?.schedule.interval !== "manual";
  const brandingReady =
    Boolean(settings?.branding.icon || settings?.branding.logo) &&
    isHexColor(settings?.branding.primary_color);

  return [
    {
      name: "Stripe account identity",
      ready:
        account.business_type === "company" &&
        account.country === expectation.country &&
        account.default_currency === expectation.currency &&
        legalNameMatches,
      readyDetail: "The live Stripe account matches the incorporated US company and USD settlement currency.",
      blocker:
        "The live Stripe account must be a US company in USD whose legal name exactly matches the incorporated seller.",
    },
    {
      name: "Stripe account submission",
      ready: account.details_submitted || bankPendingLaunchException,
      readyDetail: bankPendingLaunchException
        ? "All charge-enabling Stripe details are submitted; only the payout account remains pending."
        : "Stripe account onboarding details have been submitted.",
      blocker: "Complete and submit every required Stripe account onboarding detail.",
    },
    {
      name: "Stripe agreement acceptance",
      ready: Number(account.tos_acceptance?.date ?? 0) > 0,
      readyDetail: "The account representative has accepted the Stripe Services Agreement.",
      blocker: "The account representative must accept the Stripe Services Agreement.",
    },
    {
      name: "Stripe verification",
      ready: verificationClear || bankPendingLaunchException,
      readyDetail: bankPendingLaunchException
        ? "Stripe reports no outstanding verification requirement other than the payout account."
        : "Stripe reports no current, overdue, failed, or pending verification requirements.",
      blocker:
        "Resolve every non-bank current, overdue, failed, or pending Stripe verification requirement before launch.",
    },
    {
      name: "Stripe card payments",
      ready: cardPaymentsActive,
      readyDetail: "Live charges and the card-payments capability are active.",
      blocker: "Live charges and the Stripe card-payments capability must both be active.",
    },
    {
      name: "Stripe payouts",
      ready: account.payouts_enabled || bankPendingLaunchException,
      readyDetail: bankPendingLaunchException
        ? "The authorised bank-pending launch exception is active; proceeds will remain in Stripe until a payout account is connected."
        : "Stripe reports that funds can be paid out.",
      blocker: "Attach and verify the payout account until Stripe reports payouts as enabled.",
      warning: bankPendingLaunchException
        ? "Bank-pending launch is active: customer proceeds will remain in Stripe until the company payout account is approved and connected."
        : undefined,
    },
    {
      name: "Stripe payout schedule",
      ready: automaticPayoutSchedule || bankPendingLaunchException,
      readyDetail: bankPendingLaunchException
        ? "The automatic payout schedule is deferred until the company payout account is connected."
        : "An automatic Stripe payout schedule is configured.",
      blocker: "Configure an automatic Stripe payout schedule rather than manual payouts.",
    },
    {
      name: "Stripe business profile",
      ready:
        Boolean(profile?.name?.trim()) &&
        /frame/i.test(profile?.name ?? "") &&
        Boolean(profile?.mcc?.trim()) &&
        (profile?.product_description?.trim().length ?? 0) >= 10 &&
        normalizeUrl(profile?.url) === normalizeUrl(expectation.publicWebsite),
      readyDetail: "The public business name, website, MCC, and product description are configured.",
      blocker:
        "Complete the Frame customer-facing name, website, merchant category, and product description in Stripe.",
    },
    {
      name: "Stripe customer support",
      ready:
        profile?.support_email?.trim().toLowerCase() ===
          expectation.supportEmail.trim().toLowerCase() &&
        normalizeUrl(profile?.support_url) === normalizeUrl(expectation.supportUrl),
      readyDetail: "Stripe customer-support details point to the monitored Frame channels.",
      blocker: `Set Stripe support email to ${expectation.supportEmail} and support URL to ${expectation.supportUrl}.`,
    },
    {
      name: "Stripe statement descriptor",
      ready: hasFrameStatementDescriptor(statementDescriptor),
      readyDetail: "The customer statement descriptor is valid and recognisably identifies Frame.",
      blocker: "Set a valid 5–22 character card statement descriptor that contains FRAME.",
    },
    {
      name: "Stripe account branding",
      ready: brandingReady,
      readyDetail: "Stripe has a merchant icon or logo and a valid primary brand colour.",
      blocker: "Add a Stripe merchant icon or logo and a six-digit primary brand colour.",
    },
  ];
}

export function stripeAccountReadinessBlockers(
  account: Stripe.Account,
  expectation: StripeAccountReadinessExpectation = STRIPE_LIVE_ACCOUNT_EXPECTATION,
  options: StripeAccountReadinessOptions = {},
) {
  return evaluateStripeAccountReadiness(account, expectation, options)
    .filter((check) => !check.ready)
    .map((check) => check.blocker);
}
