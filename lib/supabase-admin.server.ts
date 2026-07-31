import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  WAITLIST_ADMIN_EMAILS?: string;
};

let cachedAdminClient: SupabaseClient | null = null;

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as SupabaseRuntimeEnv;
}

export function createSupabaseAdmin(url: string, secretKey: string) {
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getSupabaseAdmin() {
  if (cachedAdminClient) return cachedAdminClient;

  const runtimeEnv = await getRuntimeEnv();
  const url = runtimeEnv.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey =
    runtimeEnv.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  cachedAdminClient = createSupabaseAdmin(url, secretKey);
  return cachedAdminClient;
}

export async function isWaitlistAdmin(email: string) {
  const runtimeEnv = await getRuntimeEnv();
  const configuredEmails =
    runtimeEnv.WAITLIST_ADMIN_EMAILS ??
    process.env.WAITLIST_ADMIN_EMAILS ??
    "";
  const allowedEmails = configuredEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.trim().toLowerCase());
}
