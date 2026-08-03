import {
  isLocalContributorRequest,
  isLoopbackHost,
} from "./contributor-local-only";

export type FrameRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTRIBUTOR_FROM_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID?: string;
  CONTRIBUTOR_PREVIEW_MODE?: string;
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

export function isFoundingContributorSalesEnabled(host: string | null) {
  return isLoopbackHost(host);
}

export function isFoundingContributorSalesRequestEnabled(request: Request) {
  return isLocalContributorRequest(request);
}

export async function isLocalContributorPreview(request: Request) {
  const enabled = (await getRuntimeValue("CONTRIBUTOR_PREVIEW_MODE")) === "true";
  if (!enabled) return false;

  return isLoopbackHost(new URL(request.url).host);
}
