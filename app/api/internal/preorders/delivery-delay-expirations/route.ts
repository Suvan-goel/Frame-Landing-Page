import { processExpiredPreorderDeliveryUpdates } from "@/lib/preorder-delivery-expiration.server";
import { sendPreorderMaintenanceFailureEmail } from "@/lib/preorder-email.server";
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
    if (result.failures.length) {
      const origin = new URL(request.url).origin;
      const notifications = await Promise.allSettled(
        result.failures.map((failure) =>
          sendPreorderMaintenanceFailureEmail({
            origin,
            preorderId: failure.orderId,
            deliveryUpdateVersion: failure.deliveryUpdateVersion,
            error: failure.error,
          }),
        ),
      );
      for (const notification of notifications) {
        if (notification.status === "rejected") {
          console.error(
            "Pre-order maintenance failure notification failed",
            notification.reason,
          );
        }
      }
      return response({ status: "partial", ...result }, 503);
    }
    return response({ status: "complete", ...result });
  } catch (error) {
    console.error("Pre-order delivery-deadline processing failed", error);
    return response({ error: "Deadline processing failed." }, 503);
  }
}
