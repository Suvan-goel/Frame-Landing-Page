import { processExpiredPreorderDeliveryUpdates } from "@/lib/preorder-delivery-expiration.server";
import { getRuntimeValue } from "@/lib/runtime-env.server";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function authorized(request: Request) {
  const expected = await getRuntimeValue("PREORDER_MAINTENANCE_SECRET");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 32 || !supplied) return false;

  const [actualHash, expectedHash] = await Promise.all([
    digest(supplied),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return response({ error: "Not found." }, 404);
  }

  try {
    const result = await processExpiredPreorderDeliveryUpdates({
      origin: new URL(request.url).origin,
      batchSize: 25,
    });
    return response({ status: result.failures.length ? "partial" : "complete", ...result });
  } catch (error) {
    console.error("Pre-order delivery-deadline processing failed", error);
    return response({ error: "Deadline processing failed." }, 503);
  }
}
