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

export async function isLocalContributorPreview(request: Request) {
  const enabled = (await getRuntimeValue("CONTRIBUTOR_PREVIEW_MODE")) === "true";
  if (!enabled) return false;

  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
