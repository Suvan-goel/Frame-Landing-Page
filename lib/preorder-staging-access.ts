export const PREORDER_STAGING_ACCESS_PATH = "/preorder/staging-access";
export const PREORDER_STAGING_EXIT_PATH = "/preorder/staging-exit";
export const PREORDER_STAGING_COOKIE = "frame_preorder_staging";

const COOKIE_VERSION = "v1";
const COOKIE_MESSAGE = "frame-preorder-private-staging-access-v1";
const ACCESS_TOKEN_MESSAGE = "frame-preorder-private-staging-link-v1";
const MINIMUM_SECRET_LENGTH = 32;
const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

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

async function stagingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`frame-preorder-staging:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isPreorderStagingConfigured(input: {
  mode?: string;
  secret?: string;
}) {
  return input.mode === "test" && Boolean(input.secret && input.secret.length >= MINIMUM_SECRET_LENGTH);
}

export async function createPreorderStagingCookieValue(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Private pre-order staging is not configured.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await stagingKey(secret),
    new TextEncoder().encode(`${COOKIE_MESSAGE}:${expiresAt}`),
  );
  return `${COOKIE_VERSION}.${expiresAt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyPreorderStagingCookieValue(
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
    return crypto.subtle.verify(
      "HMAC",
      await stagingKey(secret),
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(`${COOKIE_MESSAGE}:${expiresAt}`),
    );
  } catch {
    return false;
  }
}

export function readPreorderStagingCookie(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === PREORDER_STAGING_COOKIE) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

export async function isPreorderStagingCookieAllowed(input: {
  mode?: string;
  secret?: string;
  cookieHeader: string | null;
}) {
  if (!isPreorderStagingConfigured(input)) return false;
  const cookie = readPreorderStagingCookie(input.cookieHeader);
  return cookie
    ? verifyPreorderStagingCookieValue(cookie, input.secret as string)
    : false;
}

export async function createPreorderStagingAccessToken(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Private pre-order staging is not configured.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = base64UrlEncode(nonceBytes);
  const message = `${ACCESS_TOKEN_MESSAGE}:${expiresAt}:${nonce}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await stagingKey(secret),
    new TextEncoder().encode(message),
  );
  return `${COOKIE_VERSION}.${expiresAt}.${nonce}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyPreorderStagingAccessToken(
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
    return crypto.subtle.verify(
      "HMAC",
      await stagingKey(secret),
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(
        `${ACCESS_TOKEN_MESSAGE}:${expiresAt}:${nonce}`,
      ),
    );
  } catch {
    return false;
  }
}

export function preorderStagingCookieHeader(value: string) {
  return `${PREORDER_STAGING_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearPreorderStagingCookieHeader() {
  return `${PREORDER_STAGING_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
