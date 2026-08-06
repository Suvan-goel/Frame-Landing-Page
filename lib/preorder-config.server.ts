import { getRuntimeValue } from "./runtime-env.server";
import {
  PREORDER_DEFAULT_ALLOWED_COUNTRIES,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_DELIVERY,
  PREORDER_PRODUCT_NAME,
  PREORDER_SKU,
} from "./preorder";

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function currencyCode(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z]{3}$/.test(normalized)
    ? normalized
    : PREORDER_DEFAULT_CURRENCY;
}

function allowedCountries(value: string | undefined) {
  const countries = (value ?? "")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country));

  return countries.length ? countries : [...PREORDER_DEFAULT_ALLOWED_COUNTRIES];
}

export async function getPreorderConfiguration() {
  const [priceCents, currency, countries, deliveryEstimate] = await Promise.all([
    getRuntimeValue("PREORDER_PRICE_CENTS"),
    getRuntimeValue("PREORDER_CURRENCY"),
    getRuntimeValue("PREORDER_ALLOWED_COUNTRIES"),
    getRuntimeValue("PREORDER_ESTIMATED_DELIVERY"),
  ]);

  return {
    sku: PREORDER_SKU,
    productName: PREORDER_PRODUCT_NAME,
    priceCents: positiveInteger(priceCents, PREORDER_DEFAULT_PRICE_CENTS),
    currency: currencyCode(currency),
    allowedCountries: allowedCountries(countries),
    estimatedDelivery:
      deliveryEstimate?.trim().slice(0, 500) || PREORDER_ESTIMATED_DELIVERY,
  };
}
