import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStripeAccountReadiness,
  stripeAccountReadinessBlockers,
  STRIPE_LIVE_ACCOUNT_EXPECTATION,
} from "../lib/preorder-stripe-account-readiness.ts";

const expectation = {
  ...STRIPE_LIVE_ACCOUNT_EXPECTATION,
  legalName: "Frame Health Technologies, Inc.",
};

function readyAccount() {
  return {
    id: "acct_ready",
    object: "account",
    business_type: "company",
    charges_enabled: true,
    country: "US",
    default_currency: "usd",
    details_submitted: true,
    email: null,
    payouts_enabled: true,
    type: "standard",
    company: { name: "Frame Health Technologies Inc" },
    capabilities: { card_payments: "active" },
    tos_acceptance: { date: 1_786_294_800 },
    requirements: {
      disabled_reason: null,
      currently_due: [],
      past_due: [],
      pending_verification: [],
      errors: [],
    },
    business_profile: {
      name: "Frame",
      mcc: "5734",
      product_description: "A non-invasive upper-arm wearable device.",
      support_email: expectation.supportEmail,
      support_url: expectation.supportUrl,
      url: expectation.publicWebsite,
    },
    settings: {
      branding: {
        icon: "file_brand_icon",
        logo: null,
        primary_color: "#20211E",
        secondary_color: "#FAF8F2",
      },
      card_payments: {
        statement_descriptor_prefix: "FRAME",
      },
      payments: {
        statement_descriptor: "FRAME",
      },
      payouts: {
        schedule: { interval: "daily", delay_days: 2 },
      },
    },
  };
}

test("accepts a fully activated live Stripe account without exposing bank details", () => {
  const checks = evaluateStripeAccountReadiness(readyAccount(), expectation);

  assert.equal(checks.length, 11);
  assert.equal(checks.every((check) => check.ready), true);
  assert.deepEqual(stripeAccountReadinessBlockers(readyAccount(), expectation), []);
});

test("accepts Stripe's current corporation business-type value", () => {
  const account = readyAccount();
  account.business_type = "corporation";

  assert.equal(
    evaluateStripeAccountReadiness(account, expectation).find(
      (check) => check.name === "Stripe account identity",
    )?.ready,
    true,
  );
});

test("blocks inactive payments, payouts, verification, identity, and customer-facing setup", () => {
  const account = readyAccount();
  account.charges_enabled = false;
  account.payouts_enabled = false;
  account.capabilities.card_payments = "pending";
  account.company.name = "Different Company LLC";
  account.requirements.pending_verification = ["company.tax_id"];
  account.tos_acceptance.date = null;
  account.business_profile.support_url = "https://example.com/help";
  account.settings.payouts.schedule.interval = "manual";
  account.settings.card_payments.statement_descriptor_prefix = "UNKNOWN";
  account.settings.branding.icon = null;
  account.settings.branding.primary_color = null;

  const failedNames = evaluateStripeAccountReadiness(account, expectation)
    .filter((check) => !check.ready)
    .map((check) => check.name);

  assert.deepEqual(failedNames, [
    "Stripe account identity",
    "Stripe agreement acceptance",
    "Stripe verification",
    "Stripe card payments",
    "Stripe payouts",
    "Stripe payout schedule",
    "Stripe customer support",
    "Stripe statement descriptor",
    "Stripe account branding",
  ]);
});

test("allows an explicitly authorised bank-pending launch when live card payments are active", () => {
  const account = readyAccount();
  account.details_submitted = false;
  account.payouts_enabled = false;
  account.requirements.currently_due = ["external_account"];
  account.requirements.past_due = ["external_account"];
  account.requirements.disabled_reason = "requirements.past_due";
  account.settings.payouts.schedule.interval = "manual";

  const checks = evaluateStripeAccountReadiness(account, expectation, {
    allowBankPendingLaunch: true,
  });

  assert.equal(checks.every((check) => check.ready), true);
  assert.deepEqual(
    checks.filter((check) => check.warning).map((check) => check.name),
    ["Stripe payouts"],
  );
  assert.deepEqual(
    stripeAccountReadinessBlockers(account, expectation, {
      allowBankPendingLaunch: true,
    }),
    [],
  );
});

test("bank-pending launch never waives a non-bank verification requirement", () => {
  const account = readyAccount();
  account.payouts_enabled = false;
  account.requirements.currently_due = ["external_account", "representative.verification.document"];
  account.settings.payouts.schedule.interval = "manual";

  const failedNames = evaluateStripeAccountReadiness(account, expectation, {
    allowBankPendingLaunch: true,
  })
    .filter((check) => !check.ready)
    .map((check) => check.name);

  assert.deepEqual(failedNames, [
    "Stripe verification",
    "Stripe payouts",
    "Stripe payout schedule",
  ]);
});

test("bank-pending launch never waives inactive live card payments", () => {
  const account = readyAccount();
  account.charges_enabled = false;
  account.payouts_enabled = false;
  account.capabilities.card_payments = "pending";
  account.requirements.currently_due = ["external_account"];
  account.settings.payouts.schedule.interval = "manual";

  const failedNames = evaluateStripeAccountReadiness(account, expectation, {
    allowBankPendingLaunch: true,
  })
    .filter((check) => !check.ready)
    .map((check) => check.name);

  assert.deepEqual(failedNames, [
    "Stripe verification",
    "Stripe card payments",
    "Stripe payouts",
    "Stripe payout schedule",
  ]);
});

test("still requires automatic payouts after Stripe enables the payout account", () => {
  const account = readyAccount();
  account.settings.payouts.schedule.interval = "manual";

  const failedNames = evaluateStripeAccountReadiness(account, expectation, {
    allowBankPendingLaunch: true,
  })
    .filter((check) => !check.ready)
    .map((check) => check.name);

  assert.deepEqual(failedNames, ["Stripe payout schedule"]);
});

test("requires a real incorporated legal name in the launch expectation", () => {
  const checks = evaluateStripeAccountReadiness(readyAccount(), {
    ...expectation,
    legalName: "",
  });

  assert.equal(
    checks.find((check) => check.name === "Stripe account identity")?.ready,
    false,
  );
});

test("fails closed when the configured key cannot return verification requirements", () => {
  const account = readyAccount();
  delete account.requirements;

  assert.equal(
    evaluateStripeAccountReadiness(account, expectation).find(
      (check) => check.name === "Stripe verification",
    )?.ready,
    false,
  );
});
