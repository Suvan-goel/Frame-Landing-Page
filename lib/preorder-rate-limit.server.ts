import { getRuntimeValue } from "./runtime-env.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export type PreorderRateLimit = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function clientAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;

  const forwardedAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (forwardedAddress) return forwardedAddress;

  return request.headers.get("x-real-ip")?.trim() || "address-unavailable";
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function subjectHash(request: Request) {
  const secret =
    (await getRuntimeValue("PREORDER_RATE_LIMIT_SECRET")) ??
    (await getRuntimeValue("PREORDER_ORDER_ACCESS_SECRET")) ??
    (await getRuntimeValue("STRIPE_WEBHOOK_SECRET"));
  if (!secret || secret.length < 24) {
    throw new Error("Pre-order endpoint protection is not configured.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`frame-preorder-rate-limit:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(clientAddress(request)),
  );
  return hex(new Uint8Array(signature));
}

export async function consumePreorderRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
}): Promise<PreorderRateLimit> {
  const supabase = await getSupabaseAdmin();
  const result = await supabase.rpc("consume_preorder_rate_limit", {
    p_scope: input.scope,
    p_subject_hash: await subjectHash(input.request),
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  if (result.error) throw result.error;

  const row = (result.data as RateLimitRow[] | null)?.[0];
  if (!row) throw new Error("Pre-order endpoint protection is unavailable.");
  return {
    allowed: row.allowed,
    remaining: Number(row.remaining),
    retryAfterSeconds: Number(row.retry_after_seconds),
  };
}
