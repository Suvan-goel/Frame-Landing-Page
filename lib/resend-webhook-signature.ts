function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function verifyResendWebhook(input: {
  payload: string;
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}) {
  const timestamp = Number(input.svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) return false;

  const secret = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(secret);
  } catch {
    return false;
  }
  const keyMaterial = Uint8Array.from(keyBytes).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${input.svixId}.${input.svixTimestamp}.${input.payload}`;
  const signature = encodeBase64(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed)),
  );
  return input.svixSignature
    .split(" ")
    .map((entry) => entry.split(",", 2))
    .some(([version, candidate]) =>
      version === "v1" && candidate ? constantTimeEqual(signature, candidate) : false,
    );
}
