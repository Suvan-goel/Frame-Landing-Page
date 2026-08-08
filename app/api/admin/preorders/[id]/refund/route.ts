import { initiatePreorderFullRefund } from "@/lib/preorder-admin-operations.server";
import {
  authorizePreorderAdminApi,
  isPreorderId,
} from "@/lib/preorder-admin-api.server";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizePreorderAdminApi(request);
  if (!authorization.user) {
    return response({ error: authorization.error }, authorization.status);
  }
  const { id } = await params;
  if (!isPreorderId(id)) return response({ error: "Invalid pre-order." }, 400);

  let payload: { requestKey?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return response({ error: "The refund request is invalid." }, 400);
  }
  const requestKey = typeof payload.requestKey === "string" ? payload.requestKey : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    return response({ error: "Refresh the page before retrying the refund." }, 400);
  }

  try {
    const result = await initiatePreorderFullRefund({
      origin: new URL(request.url).origin,
      orderId: id,
      requestKey,
    });
    return response({
      status: result.refund.status ?? "pending",
      refundId: result.refund.id,
      customerEmail: result.customerEmail,
    });
  } catch (error) {
    console.error("Pre-order refund initiation failed", error);
    const message = error instanceof Error ? error.message : "Refund initiation failed.";
    const expected =
      message.includes("not eligible") ||
      message.includes("already") ||
      message.includes("not configured") ||
      message.includes("missing");
    return response(
      { error: expected ? message : "The refund could not be started. Please try again." },
      expected ? 409 : 503,
    );
  }
}
