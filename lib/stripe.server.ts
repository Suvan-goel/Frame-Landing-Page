import Stripe from "stripe";
import type { PreorderEnvironment } from "./preorder-operations.server";
import { getPreorderMode, getRuntimeValue } from "./runtime-env.server";

const cachedStripe = new Map<string, Stripe>();

export function isStripeSecretForEnvironment(
  secretKey: string | undefined,
  environment: PreorderEnvironment,
): secretKey is string {
  return Boolean(
    secretKey &&
      (environment === "live"
        ? /^(?:sk|rk)_live_/.test(secretKey)
        : /^(?:sk|rk)_test_/.test(secretKey)),
  );
}

async function stripeSecretKey(environment?: PreorderEnvironment) {
  const dedicated = environment
    ? await getRuntimeValue(
        environment === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_TEST_SECRET_KEY",
      )
    : undefined;
  return dedicated ?? (await getRuntimeValue("STRIPE_SECRET_KEY"));
}

export async function getStripe(environment?: PreorderEnvironment) {
  const secretKey = await stripeSecretKey(environment);
  if (!secretKey) {
    throw new Error(
      environment
        ? `Stripe ${environment} mode is not configured yet.`
        : "Stripe test mode is not configured yet.",
    );
  }
  if (environment && !isStripeSecretForEnvironment(secretKey, environment)) {
    throw new Error(`Stripe ${environment} mode is not configured with a matching key.`);
  }

  const existing = cachedStripe.get(secretKey);
  if (existing) return existing;

  const stripe = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  cachedStripe.set(secretKey, stripe);
  return stripe;
}

export async function getStripePriceId() {
  const priceId = await getRuntimeValue("STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID");
  if (!priceId) {
    throw new Error("The Stripe Founding Contributor test price is not configured yet.");
  }
  return priceId;
}

export async function getStripePreorderPriceId(environment?: PreorderEnvironment) {
  const dedicated = environment
    ? await getRuntimeValue(
        environment === "live"
          ? "STRIPE_LIVE_PREORDER_PRICE_ID"
          : "STRIPE_TEST_PREORDER_PRICE_ID",
      )
    : undefined;
  const priceId = dedicated ?? (await getRuntimeValue("STRIPE_PREORDER_PRICE_ID"));
  if (!priceId) {
    throw new Error(
      environment
        ? `The Stripe pre-order ${environment} price is not configured yet.`
        : "The Stripe pre-order test price is not configured yet.",
    );
  }
  return priceId;
}

export async function verifyStripeWebhook(rawBody: string, signature: string) {
  const mode = await getPreorderMode();
  const activeEnvironment = mode === "live" || mode === "test" ? mode : null;
  const environments: Array<PreorderEnvironment | null> = activeEnvironment
    ? [activeEnvironment, activeEnvironment === "live" ? "test" : "live"]
    : ["live", "test", null];
  let lastError: unknown;

  for (const environment of environments) {
    const dedicatedSecret = environment
      ? await getRuntimeValue(
          environment === "live"
            ? "STRIPE_LIVE_WEBHOOK_SECRET"
            : "STRIPE_TEST_WEBHOOK_SECRET",
        )
      : undefined;
    const webhookSecret =
      dedicatedSecret ??
      (environment === activeEnvironment || environment === null
        ? await getRuntimeValue("STRIPE_WEBHOOK_SECRET")
        : undefined);
    if (!webhookSecret) continue;

    try {
      const stripe = await getStripe(environment ?? undefined);
      const event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
      if (environment && event.livemode !== (environment === "live")) {
        throw new Error("Stripe webhook mode does not match its signing configuration.");
      }
      return event;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("The Stripe webhook secret is not configured yet.");
}
