import { getRuntimeValue } from "./runtime-env.server";

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 540 * 24 * 60 * 60;

type ManageTokenPayload = {
  v: number;
  orderId: string;
  tokenVersion: number;
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

export async function createPreorderManagePath(input: {
  orderId: string;
  tokenVersion: number;
}) {
  const token = await createPreorderManageToken(input);
  return `/preorder/manage?token=${encodeURIComponent(token)}`;
}

export async function verifyPreorderManageToken(token: string) {
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

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    ) as Partial<ManageTokenPayload>;
    if (
      payload.v !== TOKEN_VERSION ||
      typeof payload.orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.orderId) ||
      !Number.isSafeInteger(payload.tokenVersion) ||
      Number(payload.tokenVersion) < 1 ||
      !Number.isSafeInteger(payload.expiresAt) ||
      Number(payload.expiresAt) <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as ManageTokenPayload;
  } catch {
    return null;
  }
}
