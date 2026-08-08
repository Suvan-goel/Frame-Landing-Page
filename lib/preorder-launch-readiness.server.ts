import Stripe from "stripe";
import { isPreorderLiveApproved } from "./preorder-access";
import { getPreorderConfiguration } from "./preorder-config.server";
import {
  PREORDER_DEFAULT_ALLOWED_COUNTRIES,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_MAX_INVENTORY_UNITS,
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_SHIPPING_RATE_CENTS,
} from "./preorder";
import { getPreorderSalesSnapshot } from "./preorder-operations.server";
import { getPreorderMode, getRuntimeValue } from "./runtime-env.server";
import { isStripeSecretForEnvironment } from "./stripe.server";

export type PreorderLaunchReadiness = {
  ready: boolean;
  blockers: string[];
};

function configuredSecret(value: string | undefined) {
  return Boolean(value && value.length >= 32);
}

function configuredEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

const requiredWebhookEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "refund.created",
  "refund.updated",
  "charge.refunded",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export async function evaluatePreorderLaunchReadiness(): Promise<PreorderLaunchReadiness> {
  const [
    mode,
    approvedTermsVersion,
    dedicatedLiveStripeSecretKey,
    dedicatedLiveStripePriceId,
    dedicatedLiveStripeWebhookSecret,
    liveStripeWebhookEndpointId,
    resendApiKey,
    preorderFromEmail,
    operationsEmail,
    adminEmails,
    orderAccessSecret,
    rateLimitSecret,
    configuration,
    liveSalesSnapshot,
  ] = await Promise.all([
    getPreorderMode(),
    getRuntimeValue("PREORDER_LEGAL_APPROVED_VERSION"),
    getRuntimeValue("STRIPE_LIVE_SECRET_KEY"),
    getRuntimeValue("STRIPE_LIVE_PREORDER_PRICE_ID"),
    getRuntimeValue("STRIPE_LIVE_WEBHOOK_SECRET"),
    getRuntimeValue("STRIPE_LIVE_WEBHOOK_ENDPOINT_ID"),
    getRuntimeValue("RESEND_API_KEY"),
    getRuntimeValue("PREORDER_FROM_EMAIL"),
    getRuntimeValue("PREORDER_OPERATIONS_EMAIL"),
    getRuntimeValue("WAITLIST_ADMIN_EMAILS"),
    getRuntimeValue("PREORDER_ORDER_ACCESS_SECRET"),
    getRuntimeValue("PREORDER_RATE_LIMIT_SECRET"),
    getPreorderConfiguration(),
    getPreorderSalesSnapshot("live").catch(() => null),
  ]);

  const stripeSecretKey = dedicatedLiveStripeSecretKey;
  const stripePriceId = dedicatedLiveStripePriceId;
  const stripeWebhookSecret = dedicatedLiveStripeWebhookSecret;

  const blockers: string[] = [];
  if (!PREORDER_SELLER_DETAILS_COMPLETE) {
    blockers.push("The incorporated seller's legal identity and contact details are not complete.");
  }
  if (!isPreorderLiveApproved({ mode, approvedTermsVersion })) {
    blockers.push("Approved, non-draft pre-order terms are not active in live mode.");
  }
  if (!isStripeSecretForEnvironment(stripeSecretKey, "live")) {
    blockers.push("A dedicated live Stripe secret key is not configured.");
  }
  if (!stripePriceId?.startsWith("price_")) {
    blockers.push("A dedicated live Stripe pre-order price is not configured.");
  }
  if (!stripeWebhookSecret?.startsWith("whsec_") || stripeWebhookSecret.length < 24) {
    blockers.push("A dedicated signed live Stripe webhook is not configured.");
  }
  if (!liveStripeWebhookEndpointId?.startsWith("we_")) {
    blockers.push("The live Stripe webhook endpoint reference is not configured.");
  }
  if (!resendApiKey?.startsWith("re_") || !preorderFromEmail?.trim()) {
    blockers.push("Customer email delivery is not configured.");
  }
  const operationsRecipient =
    operationsEmail?.trim() ??
    adminEmails
      ?.split(",")
      .map((email) => email.trim())
      .find(Boolean);
  if (!configuredEmail(operationsRecipient)) {
    blockers.push("A valid pre-order operations recipient is not configured.");
  }
  if (!configuredSecret(orderAccessSecret)) {
    blockers.push("A dedicated customer order-link signing secret is not configured.");
  }
  if (!configuredSecret(rateLimitSecret)) {
    blockers.push("A dedicated endpoint-protection signing secret is not configured.");
  }
  if (orderAccessSecret && rateLimitSecret && orderAccessSecret === rateLimitSecret) {
    blockers.push("Order-link and endpoint-protection secrets must be different.");
  }

  if (
    configuration.priceCents !== PREORDER_DEFAULT_PRICE_CENTS ||
    configuration.currency !== PREORDER_DEFAULT_CURRENCY ||
    configuration.allowedCountries.join(",") !==
      PREORDER_DEFAULT_ALLOWED_COUNTRIES.join(",") ||
    configuration.estimatedShipping !== PREORDER_ESTIMATED_SHIPPING
  ) {
    blockers.push("The runtime offer does not match the reviewed $299, US-only, March 2027 estimated-shipping configuration.");
  }
  if (configuration.shippingRateCents !== PREORDER_SHIPPING_RATE_CENTS) {
    blockers.push("The pre-order shipping charge is not the reviewed $19 USD rate.");
  }
  if (!liveSalesSnapshot) {
    blockers.push("The live inventory ceiling and release allocation could not be verified.");
  } else {
    if (liveSalesSnapshot.inventoryLimit !== PREORDER_MAX_INVENTORY_UNITS) {
      blockers.push("The live lifetime inventory ceiling is not 1,000 units.");
    }
    if (
      liveSalesSnapshot.unitLimit === null ||
      liveSalesSnapshot.unitLimit < 1 ||
      liveSalesSnapshot.unitLimit > PREORDER_MAX_INVENTORY_UNITS
    ) {
      blockers.push("A controlled live release allocation between 1 and 1,000 units is required.");
    }
  }

  if (isStripeSecretForEnvironment(stripeSecretKey, "live") && stripePriceId?.startsWith("price_")) {
    try {
      const stripe = new Stripe(stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });
      const price = await stripe.prices.retrieve(stripePriceId, {
        expand: ["product"],
      });
      const product =
        typeof price.product === "string" || !price.product || price.product.deleted
          ? null
          : price.product;
      if (
        !price.active ||
        !price.livemode ||
        price.type !== "one_time" ||
        price.unit_amount !== configuration.priceCents ||
        price.currency !== configuration.currency ||
        price.tax_behavior !== "exclusive" ||
        !product?.active
      ) {
        blockers.push("The live Stripe product and price do not match the reviewed offer.");
      }
      if (product && !product.tax_code) {
        blockers.push("The live Stripe product does not have an approved tax code.");
      }
    } catch {
      blockers.push("The live Stripe product and price could not be verified.");
    }
  }

  if (
    isStripeSecretForEnvironment(stripeSecretKey, "live") &&
    liveStripeWebhookEndpointId?.startsWith("we_")
  ) {
    try {
      const stripe = new Stripe(stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });
      const endpoint = await stripe.webhookEndpoints.retrieve(
        liveStripeWebhookEndpointId,
      );
      const missingEvents = requiredWebhookEvents.filter(
        (eventType) =>
          !endpoint.enabled_events.includes("*") &&
          !endpoint.enabled_events.includes(eventType),
      );
      if (
        endpoint.status !== "enabled" ||
        !endpoint.livemode ||
        endpoint.url !== "https://framewearable.com/api/stripe/webhook" ||
        missingEvents.length
      ) {
        blockers.push("The live Stripe webhook endpoint is not enabled for every required event.");
      }
    } catch {
      blockers.push("The live Stripe webhook endpoint could not be verified.");
    }
  }

  return { ready: blockers.length === 0, blockers };
}
