export type FrameRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTRIBUTOR_FROM_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_FOUNDING_CONTRIBUTOR_PRICE_ID?: string;
  NEXT_PUBLIC_FOUNDING_CONTRIBUTORS_ENABLED?: string;
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

function isLoopbackHost(host: string | null) {
  const normalized = host?.trim().toLowerCase() ?? "";
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "[::1]" ||
    normalized.startsWith("[::1]:")
  );
}

export async function isFoundingContributorSalesEnabled(host: string | null) {
  if (
    (await getRuntimeValue("NEXT_PUBLIC_FOUNDING_CONTRIBUTORS_ENABLED")) ===
    "true"
  ) {
    return true;
  }

  return (
    isLoopbackHost(host) &&
    (await getRuntimeValue("CONTRIBUTOR_PREVIEW_MODE")) === "true"
  );
}

export async function isFoundingContributorSalesRequestEnabled(request: Request) {
  return isFoundingContributorSalesEnabled(new URL(request.url).host);
}

export async function isLocalContributorPreview(request: Request) {
  const enabled = (await getRuntimeValue("CONTRIBUTOR_PREVIEW_MODE")) === "true";
  if (!enabled) return false;

  return isLoopbackHost(new URL(request.url).host);
}
