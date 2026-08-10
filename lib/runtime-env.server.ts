import {
  isContributorFeatureEnabled,
  isLocalContributorRequest,
  isLoopbackHost,
} from "./contributor-local-only";
import {
  isPreorderRequestAllowed,
  normalizePreorderMode,
} from "./preorder-access";

export type FrameRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  WAITLIST_ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  MAILING_FROM_EMAIL?: string;
  MAILING_REPLY_TO_EMAIL?: string;
  MAILING_POSTAL_ADDRESS?: string;
  CONTRIBUTOR_FROM_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_TEST_SECRET_KEY?: string;
  STRIPE_LIVE_SECRET_KEY?: string;
  STRIPE_TEST_WEBHOOK_SECRET?: string;
  STRIPE_LIVE_WEBHOOK_SECRET?: string;
  STRIPE_TEST_WEBHOOK_ENDPOINT_ID?: string;
  STRIPE_LIVE_WEBHOOK_ENDPOINT_ID?: string;
  STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID?: string;
  CONTRIBUTOR_FEATURE_ENABLED?: string;
  CONTRIBUTOR_PREVIEW_MODE?: string;
  PREORDER_MODE?: string;
  PREORDER_LEGAL_APPROVED_VERSION?: string;
  PREORDER_PRODUCT_STATUS_APPROVED_VERSION?: string;
  PREORDER_TAX_REVIEW_APPROVED_VERSION?: string;
  PREORDER_PREVIEW_MODE?: string;
  PREORDER_PRICE_CENTS?: string;
  PREORDER_CURRENCY?: string;
  PREORDER_ALLOWED_COUNTRIES?: string;
  PREORDER_ESTIMATED_SHIPPING?: string;
  PREORDER_SHIPPING_RATE_CENTS?: string;
  PREORDER_ESTIMATED_DELIVERY?: string;
  STRIPE_PREORDER_PRICE_ID?: string;
  STRIPE_TEST_PREORDER_PRICE_ID?: string;
  STRIPE_LIVE_PREORDER_PRICE_ID?: string;
  PREORDER_FROM_EMAIL?: string;
  PREORDER_ORDER_ACCESS_SECRET?: string;
  PREORDER_RATE_LIMIT_SECRET?: string;
  PREORDER_STAGING_ACCESS_SECRET?: string;
  PREORDER_LIVE_SMOKE_ACCESS_SECRET?: string;
  PREORDER_PUBLIC_LAUNCH_ENABLED?: string;
  PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID?: string;
  PREORDER_OPERATIONS_EMAIL?: string;
  PREORDER_MAINTENANCE_SECRET?: string;
};

export async function getFrameRuntimeEnv(): Promise<FrameRuntimeEnv> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as FrameRuntimeEnv;
  } catch {
    return process.env as FrameRuntimeEnv;
  }
}

export async function getRuntimeValue(key: keyof FrameRuntimeEnv) {
  const runtimeEnv = await getFrameRuntimeEnv();
  return runtimeEnv[key] ?? process.env[key];
}

export function isFoundingContributorSalesEnabled(
  host: string | null,
  configured: string | null | undefined,
) {
  return isContributorFeatureEnabled(configured) && isLoopbackHost(host);
}

export async function isFoundingContributorSalesRequestEnabled(request: Request) {
  if (request.headers.get("x-frame-contributor-local-request") === "1") {
    return true;
  }
  return (
    isContributorFeatureEnabled(
      await getRuntimeValue("CONTRIBUTOR_FEATURE_ENABLED"),
    ) && isLocalContributorRequest(request)
  );
}

export async function isLocalContributorPreview(request: Request) {
  const featureEnabled = isContributorFeatureEnabled(
    await getRuntimeValue("CONTRIBUTOR_FEATURE_ENABLED"),
  );
  const enabled = (await getRuntimeValue("CONTRIBUTOR_PREVIEW_MODE")) === "true";
  if (!featureEnabled || !enabled) return false;

  return isLoopbackHost(new URL(request.url).host);
}

export async function getPreorderMode() {
  return normalizePreorderMode(await getRuntimeValue("PREORDER_MODE"));
}

export async function isPreorderSalesRequestEnabled(request: Request) {
  if (request.headers.get("x-frame-preorder-sales-request") === "1") return true;
  return isPreorderRequestAllowed({
    host: new URL(request.url).host,
    mode: await getRuntimeValue("PREORDER_MODE"),
    approvedTermsVersion: await getRuntimeValue("PREORDER_LEGAL_APPROVED_VERSION"),
    approvedProductStatusVersion: await getRuntimeValue(
      "PREORDER_PRODUCT_STATUS_APPROVED_VERSION",
    ),
    publicLaunchEnabled: await getRuntimeValue("PREORDER_PUBLIC_LAUNCH_ENABLED"),
    verifiedLiveSmokeOrderId: await getRuntimeValue(
      "PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID",
    ),
  });
}

export async function isLocalPreorderPreview(request: Request) {
  const configured = await getRuntimeValue("PREORDER_PREVIEW_MODE");
  const enabled = configured !== "false";
  if (!enabled) return false;

  return isLoopbackHost(new URL(request.url).host);
}
