export const PREORDER_SKU = "frame-device-preorder-v1";
export const PREORDER_PRODUCT_NAME = "Frame device pre-order";
// The Pre-order Terms and Cancellation and Refund Policy are accepted together
// and versioned as one legal pack. The database retains `terms_version` for compatibility.
export const PREORDER_LEGAL_PACK_VERSION = "draft-2026-08-08-v6";
export const PREORDER_TERMS_VERSION = PREORDER_LEGAL_PACK_VERSION;
export const PREORDER_LEGAL_PACK_UPDATED = "August 8, 2026";
export const PREORDER_PRODUCT_STATUS_VERSION = "draft-2026-08-08-v6";
export const PREORDER_PRODUCT_STATUS_UPDATED = "August 8, 2026";
// This is deliberately false until the incorporated seller's legal name,
// company number, registered office, and support details are in the policies.
export const PREORDER_SELLER_DETAILS_COMPLETE = false;
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
export const PREORDER_SHIPPING_RATE_CENTS = 1_900;
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
  return `One Frame wearable device pre-order. ${input.sandbox ? "Sandbox only. " : ""}Estimated shipping: ${input.estimatedShipping}; timing may change.`;
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

export function isDraftPreorderVersion(version: string) {
  return version.toLowerCase().startsWith("draft");
}
