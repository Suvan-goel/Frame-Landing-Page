import { readFile } from "node:fs/promises";
import Stripe from "stripe";
import {
  preorderStripeProductDescription,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_STRIPE_PRODUCT_IMAGE_URL,
  PREORDER_STRIPE_PRODUCT_NAME,
  PREORDER_STRIPE_PRODUCT_TAX_CODE,
} from "../lib/preorder.ts";

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

const environment = process.argv.includes("--live") ? "live" : "test";
const secretKey = environment === "live"
  ? process.env.STRIPE_LIVE_SECRET_KEY
  : process.env.STRIPE_TEST_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
if (!new RegExp(`^(?:sk|rk)_${environment}_`).test(secretKey ?? "")) {
  throw new Error(`A Stripe ${environment} secret key is required.`);
}

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });
const sandbox = environment === "test";
const description = preorderStripeProductDescription({
  estimatedShipping: PREORDER_ESTIMATED_SHIPPING,
  sandbox,
});
const products = await stripe.products.list({ active: true, limit: 100 });
let product = products.data.find(
  (candidate) =>
    candidate.name === PREORDER_STRIPE_PRODUCT_NAME &&
    candidate.metadata.offer_type === "reservation",
);

if (!product) {
  product = await stripe.products.create(
    {
      name: PREORDER_STRIPE_PRODUCT_NAME,
      description,
      images: [PREORDER_STRIPE_PRODUCT_IMAGE_URL],
      tax_code: PREORDER_STRIPE_PRODUCT_TAX_CODE,
      metadata: {
        offer_type: "reservation",
        reservation_amount: String(PREORDER_DEFAULT_PRICE_CENTS),
        preorder_batch: "q1_2027",
        environment,
      },
    },
    { idempotencyKey: `frame-reservation-product-${environment}-v1` },
  );
}

if (
  product.description !== description ||
  product.tax_code !== PREORDER_STRIPE_PRODUCT_TAX_CODE ||
  product.images[0] !== PREORDER_STRIPE_PRODUCT_IMAGE_URL ||
  product.metadata.offer_type !== "reservation" ||
  product.metadata.reservation_amount !== String(PREORDER_DEFAULT_PRICE_CENTS) ||
  product.metadata.preorder_batch !== "q1_2027" ||
  product.metadata.environment !== environment
) {
  product = await stripe.products.update(product.id, {
    description,
    images: [PREORDER_STRIPE_PRODUCT_IMAGE_URL],
    tax_code: PREORDER_STRIPE_PRODUCT_TAX_CODE,
    metadata: {
      offer_type: "reservation",
      reservation_amount: String(PREORDER_DEFAULT_PRICE_CENTS),
      preorder_batch: "q1_2027",
      environment,
    },
  });
}

const prices = await stripe.prices.list({
  active: true,
  product: product.id,
  type: "one_time",
  limit: 100,
});
let price = prices.data.find(
  (candidate) =>
    candidate.currency === PREORDER_DEFAULT_CURRENCY &&
    candidate.unit_amount === PREORDER_DEFAULT_PRICE_CENTS &&
    candidate.tax_behavior === "exclusive" &&
    candidate.metadata.offer_type === "reservation",
);

if (!price) {
  price = await stripe.prices.create(
    {
      product: product.id,
      currency: PREORDER_DEFAULT_CURRENCY,
      unit_amount: PREORDER_DEFAULT_PRICE_CENTS,
      tax_behavior: "exclusive",
      metadata: {
        offer_type: "reservation",
        reservation_amount: String(PREORDER_DEFAULT_PRICE_CENTS),
        preorder_batch: "q1_2027",
        environment,
      },
    },
    { idempotencyKey: `frame-reservation-price-${environment}-usd-9900-v1` },
  );
}

if (
  price.metadata.offer_type !== "reservation" ||
  price.metadata.reservation_amount !== String(PREORDER_DEFAULT_PRICE_CENTS) ||
  price.metadata.preorder_batch !== "q1_2027" ||
  price.metadata.environment !== environment
) {
  price = await stripe.prices.update(price.id, {
    metadata: {
      offer_type: "reservation",
      reservation_amount: String(PREORDER_DEFAULT_PRICE_CENTS),
      preorder_batch: "q1_2027",
      environment,
    },
  });
}


if (product.default_price !== price.id) {
  product = await stripe.products.update(product.id, { default_price: price.id });
}

console.log(JSON.stringify({ environment, productId: product.id, priceId: price.id }));
