export const PREORDER_LIVE_SMOKE_ACCESS_PATH = "/preorder/live-smoke-access";
export const PREORDER_LIVE_SMOKE_EXIT_PATH = "/preorder/live-smoke-exit";
export const PREORDER_LIVE_SMOKE_COOKIE = "frame_preorder_live_smoke";

const COOKIE_VERSION = "v1";
const COOKIE_MESSAGE = "frame-preorder-private-live-smoke-access-v1";
const ACCESS_TOKEN_MESSAGE = "frame-preorder-private-live-smoke-link-v1";
const MINIMUM_SECRET_LENGTH = 32;
const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const VERIFIED_ORDER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function liveSmokeKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`frame-preorder-live-smoke:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isPreorderPublicLaunchConfigured(input: {
  enabled?: string;
  verifiedOrderId?: string;
}) {
  return (
    input.enabled === "true" &&
    VERIFIED_ORDER_ID.test(input.verifiedOrderId?.trim() ?? "")
  );
}

export function isPreorderLiveSmokeConfigured(input: {
  mode?: string;
  publicLaunchEnabled?: string;
  verifiedOrderId?: string;
  secret?: string;
}) {
  return (
    input.mode === "live" &&
    input.publicLaunchEnabled === "false" &&
    !input.verifiedOrderId?.trim() &&
    Boolean(input.secret && input.secret.length >= MINIMUM_SECRET_LENGTH)
  );
}

export async function createPreorderLiveSmokeCookieValue(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Private live pre-order verification is not configured.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await liveSmokeKey(secret),
    new TextEncoder().encode(`${COOKIE_MESSAGE}:${expiresAt}`),
  );
  return `${COOKIE_VERSION}.${expiresAt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyPreorderLiveSmokeCookieValue(
  value: string,
  secret: string,
) {
  const [version, encodedExpiry, encodedSignature, extra] = value.split(".");
  const expiresAt = Number(encodedExpiry);
  const now = Math.floor(Date.now() / 1000);
  if (
    version !== COOKIE_VERSION ||
    !/^\d{10}$/.test(encodedExpiry ?? "") ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + COOKIE_MAX_AGE_SECONDS + 60 ||
    !encodedSignature ||
    extra ||
    encodedSignature.length > 100 ||
    secret.length < MINIMUM_SECRET_LENGTH
  ) {
    return false;
  }
  try {
    const signature = base64UrlDecode(encodedSignature);
    if (base64UrlEncode(signature) !== encodedSignature) return false;
    return crypto.subtle.verify(
      "HMAC",
      await liveSmokeKey(secret),
      signature,
      new TextEncoder().encode(`${COOKIE_MESSAGE}:${expiresAt}`),
    );
  } catch {
    return false;
  }
}

export function readPreorderLiveSmokeCookie(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === PREORDER_LIVE_SMOKE_COOKIE) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

export async function isPreorderLiveSmokeCookieAllowed(input: {
  mode?: string;
  publicLaunchEnabled?: string;
  verifiedOrderId?: string;
  secret?: string;
  cookieHeader: string | null;
}) {
  if (!isPreorderLiveSmokeConfigured(input)) return false;
  const cookie = readPreorderLiveSmokeCookie(input.cookieHeader);
  return cookie
    ? verifyPreorderLiveSmokeCookieValue(cookie, input.secret as string)
    : false;
}

export async function createPreorderLiveSmokeAccessToken(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Private live pre-order verification is not configured.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = base64UrlEncode(nonceBytes);
  const message = `${ACCESS_TOKEN_MESSAGE}:${expiresAt}:${nonce}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await liveSmokeKey(secret),
    new TextEncoder().encode(message),
  );
  return `${COOKIE_VERSION}.${expiresAt}.${nonce}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyPreorderLiveSmokeAccessToken(
  token: string,
  secret: string,
) {
  const [version, encodedExpiry, nonce, encodedSignature, extra] = token.split(".");
  const expiresAt = Number(encodedExpiry);
  const now = Math.floor(Date.now() / 1000);
  if (
    secret.length < MINIMUM_SECRET_LENGTH ||
    version !== COOKIE_VERSION ||
    !/^\d{10}$/.test(encodedExpiry ?? "") ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + ACCESS_TOKEN_TTL_SECONDS + 60 ||
    !/^[A-Za-z0-9_-]{20,24}$/.test(nonce ?? "") ||
    !encodedSignature ||
    encodedSignature.length > 100 ||
    extra
  ) {
    return false;
  }
  try {
    const signature = base64UrlDecode(encodedSignature);
    if (base64UrlEncode(signature) !== encodedSignature) return false;
    return crypto.subtle.verify(
      "HMAC",
      await liveSmokeKey(secret),
      signature,
      new TextEncoder().encode(
        `${ACCESS_TOKEN_MESSAGE}:${expiresAt}:${nonce}`,
      ),
    );
  } catch {
    return false;
  }
}

export function preorderLiveSmokeCookieHeader(value: string) {
  return `${PREORDER_LIVE_SMOKE_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearPreorderLiveSmokeCookieHeader() {
  return `${PREORDER_LIVE_SMOKE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
