import Stripe from "stripe";
import { getRuntimeValue } from "./runtime-env.server";

let cachedStripe: Stripe | null = null;

export async function getStripe() {
  if (cachedStripe) return cachedStripe;

  const secretKey = await getRuntimeValue("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throw new Error("Stripe test mode is not configured yet.");
  }

  cachedStripe = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return cachedStripe;
}

export async function getStripePriceId() {
  const priceId = await getRuntimeValue("STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID");
  if (!priceId) {
    throw new Error("The Stripe Founding Contributor test price is not configured yet.");
  }
  return priceId;
}

export async function verifyStripeWebhook(rawBody: string, signature: string) {
  const webhookSecret = await getRuntimeValue("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    throw new Error("The Stripe webhook secret is not configured yet.");
  }

  const stripe = await getStripe();
  return stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    webhookSecret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
