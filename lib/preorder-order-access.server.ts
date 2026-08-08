import { getRuntimeValue } from "./runtime-env.server";

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 540 * 24 * 60 * 60;
const EMAIL_CHANGE_TOKEN_TTL_SECONDS = 30 * 60;

type ManageTokenPayload = {
  v: number;
  orderId: string;
  tokenVersion: number;
  expiresAt: number;
};

type EmailChangeTokenPayload = {
  v: number;
  kind: "email_change";
  orderId: string;
  tokenVersion: number;
  currentEmail: string;
  newEmail: string;
  expiresAt: number;
};

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

async function signingKey() {
  const secret =
    (await getRuntimeValue("PREORDER_ORDER_ACCESS_SECRET")) ??
    (await getRuntimeValue("STRIPE_WEBHOOK_SECRET"));
  if (!secret || secret.length < 24) {
    throw new Error("Customer order-management links are not configured.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`frame-preorder-order-access:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: Record<string, unknown>) {
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifiedPayload(token: string) {
  if (!token || token.length > 1_500) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  try {
    const verified = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!verified) return null;
    return JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validOrderAccessPayload(payload: Record<string, unknown>) {
  return (
    payload.v === TOKEN_VERSION &&
    typeof payload.orderId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.orderId) &&
    Number.isSafeInteger(payload.tokenVersion) &&
    Number(payload.tokenVersion) >= 1 &&
    Number.isSafeInteger(payload.expiresAt) &&
    Number(payload.expiresAt) > Math.floor(Date.now() / 1000)
  );
}

export async function createPreorderManageToken(input: {
  orderId: string;
  tokenVersion: number;
}) {
  const payload: ManageTokenPayload = {
    v: TOKEN_VERSION,
    orderId: input.orderId,
    tokenVersion: input.tokenVersion,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  return signPayload(payload);
}

export async function createPreorderManagePath(input: {
  orderId: string;
  tokenVersion: number;
}) {
  const token = await createPreorderManageToken(input);
  return `/preorder/manage?token=${encodeURIComponent(token)}`;
}

export async function verifyPreorderManageToken(token: string) {
  const payload = await verifiedPayload(token);
  if (!payload || payload.kind || !validOrderAccessPayload(payload)) return null;
  return payload as ManageTokenPayload;
}

export async function createPreorderEmailChangeToken(input: {
  orderId: string;
  tokenVersion: number;
  currentEmail: string;
  newEmail: string;
}) {
  const payload: EmailChangeTokenPayload = {
    v: TOKEN_VERSION,
    kind: "email_change",
    orderId: input.orderId,
    tokenVersion: input.tokenVersion,
    currentEmail: input.currentEmail,
    newEmail: input.newEmail,
    expiresAt: Math.floor(Date.now() / 1000) + EMAIL_CHANGE_TOKEN_TTL_SECONDS,
  };
  return signPayload(payload);
}

export async function verifyPreorderEmailChangeToken(token: string) {
  const payload = await verifiedPayload(token);
  if (
    !payload ||
    payload.kind !== "email_change" ||
    !validOrderAccessPayload(payload) ||
    typeof payload.currentEmail !== "string" ||
    typeof payload.newEmail !== "string" ||
    payload.currentEmail.length > 254 ||
    payload.newEmail.length > 254 ||
    payload.currentEmail === payload.newEmail
  ) {
    return null;
  }
  return payload as EmailChangeTokenPayload;
}
