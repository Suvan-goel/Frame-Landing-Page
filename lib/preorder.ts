export const PREORDER_SKU = "frame-device-preorder-v1";
export const PREORDER_PRODUCT_NAME = "Frame device pre-order";
export const PREORDER_TERMS_VERSION = "draft-2026-08-04-v1";
export const PREORDER_PRODUCT_STATUS_VERSION = "draft-2026-08-04-v1";
export const PREORDER_DEFAULT_PRICE_CENTS = 29_900;
export const PREORDER_DEFAULT_CURRENCY = "usd";
export const PREORDER_DEFAULT_ALLOWED_COUNTRIES = ["US"] as const;
export const PREORDER_MAX_QUANTITY = 1;
export const PREORDER_ESTIMATED_DELIVERY =
  "January 1, 2027";

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
