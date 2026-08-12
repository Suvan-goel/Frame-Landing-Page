import { COMPANY_DETAILS_COMPLETE } from "./company.ts";

export const PREORDER_SKU = "frame-device-preorder-v1";
export const PREORDER_PRODUCT_NAME = "Frame device pre-order";
export const PREORDER_STRIPE_PRODUCT_NAME = "Frame pre-order";
export const PREORDER_REVIEWED_PRODUCT_IMAGE_PATH =
  "/frame-product-concept-realistic-v3-transparent.png";
// Stripe hosts the reviewed asset after it is uploaded through the Dashboard.
// Keep this exact URL aligned with the live Product so checkout drift is rejected.
export const PREORDER_STRIPE_PRODUCT_IMAGE_URL =
  "https://files.stripe.com/links/MDB8YWNjdF8xVTJVMUJDYXlaejdRRXVvfGZsX2xpdmVfQU0wQjVUdW9VZ0V2YnBReFBwSmFZZGg000RyAxAU5t";
// The Pre-order Terms and Cancellation and Refund Policy are accepted together
// and versioned as one legal pack. The database retains `terms_version` for compatibility.
export const PREORDER_LEGAL_PACK_VERSION = "2026-08-12-v1";
export const PREORDER_TERMS_VERSION = PREORDER_LEGAL_PACK_VERSION;
export const PREORDER_LEGAL_PACK_UPDATED = "August 12, 2026";
export const PREORDER_PRODUCT_STATUS_VERSION = "2026-08-12-v1";
export const PREORDER_PRODUCT_STATUS_UPDATED = "August 12, 2026";
// This remains false until the single incorporated-company configuration has
// a valid legal name, registration number, registered office, separately
// authorised correspondence address, jurisdiction, support contact, privacy
// controller, and named warranty provider.
export const PREORDER_SELLER_DETAILS_COMPLETE = COMPANY_DETAILS_COMPLETE;
// The one-year limited hardware warranty is now defined in the legal pack.
// Seller identity remains a separate launch gate because the warrantor must be named.
export const PREORDER_WARRANTY_DETAILS_COMPLETE = true;
export const PREORDER_DEFAULT_PRICE_CENTS = 29_900;
export const PREORDER_RELEASE_PRICE_CENTS = 49_900;
export const PREORDER_SAVINGS_CENTS =
  PREORDER_RELEASE_PRICE_CENTS - PREORDER_DEFAULT_PRICE_CENTS;
export const PREORDER_DISCOUNT_PERCENT = Math.round(
  (PREORDER_SAVINGS_CENTS / PREORDER_RELEASE_PRICE_CENTS) * 100,
);
export const PREORDER_SHIPPING_RATE_CENTS = 0;
export const PREORDER_DEFAULT_CURRENCY = "usd";
export const PREORDER_DEFAULT_ALLOWED_COUNTRIES = ["US"] as const;
export const PREORDER_MAX_QUANTITY = 1;
export const PREORDER_ESTIMATED_SHIPPING = "Q1 2027";
// Existing database columns retain their original name for migration compatibility.
export const PREORDER_ESTIMATED_DELIVERY = PREORDER_ESTIMATED_SHIPPING;
export const PREORDER_MAX_INVENTORY_UNITS = 1_000;
export const PREORDER_CHECKOUT_SESSION_TTL_SECONDS = 60 * 60;
export const PREORDER_STRIPE_PRODUCT_TAX_CODE = "txcd_99999999";

export function preorderStripeProductDescription(input: {
  estimatedShipping: string;
  sandbox: boolean;
}) {
  return `${input.sandbox ? "Sandbox only. " : ""}Frame upper-arm wearable pre-order · Free US shipping · Estimated shipping ${input.estimatedShipping}.`;
}

export function formatPreorderNumber(value: number | string) {
  return `FR-${String(value).padStart(6, "0")}`;
}

export function formatPreorderMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(currency.toLowerCase() === "usd" ? "en-US" : "en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPreorderShipping(cents: number, currency: string) {
  return cents === 0 ? "Free" : formatPreorderMoney(cents, currency);
}

export function isDraftPreorderVersion(version: string) {
  return version.toLowerCase().startsWith("draft");
}
