import { retryPreorderConfirmationEmail } from "@/lib/preorder-admin-operations.server";
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

  try {
    await retryPreorderConfirmationEmail({
      origin: new URL(request.url).origin,
      orderId: id,
    });
    return response({ status: "sent" });
  } catch (error) {
    console.error("Pre-order confirmation retry failed", error);
    return response(
      {
        error:
          error instanceof Error && error.message.includes("not configured")
            ? "Email delivery is not configured yet. Add Resend before retrying."
            : "The confirmation email could not be sent. Please try again.",
      },
      503,
    );
  }
}
