import { getChatGPTUser } from "@/app/chatgpt-auth";
import { evaluatePreorderLaunchReadiness } from "@/lib/preorder-launch-readiness.server";
import {
  updatePreorderSalesControl,
  type PreorderEnvironment,
  type PreorderSalesStatus,
} from "@/lib/preorder-operations.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_048;
const environments = new Set<PreorderEnvironment>(["test", "live"]);
const salesStatuses = new Set<PreorderSalesStatus>([
  "open",
  "paused",
  "sold_out",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const user = await getChatGPTUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401);
  if (!(await isWaitlistAdmin(user.email))) {
    return jsonResponse({ error: "Not authorized." }, 403);
  }

  let payload: {
    environment?: unknown;
    salesStatus?: unknown;
    unitLimit?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Choose a sales status and capacity." }, 400);
  }

  if (
    typeof payload.environment !== "string" ||
    !environments.has(payload.environment as PreorderEnvironment)
  ) {
    return jsonResponse({ error: "Choose a valid payment environment." }, 400);
  }
  if (
    typeof payload.salesStatus !== "string" ||
    !salesStatuses.has(payload.salesStatus as PreorderSalesStatus)
  ) {
    return jsonResponse({ error: "Choose a valid sales status." }, 400);
  }

  const environment = payload.environment as PreorderEnvironment;
  const salesStatus = payload.salesStatus as PreorderSalesStatus;
  const unitLimit = payload.unitLimit === null ? null : Number(payload.unitLimit);
  if (
    unitLimit !== null &&
    (!Number.isSafeInteger(unitLimit) || unitLimit < 1 || unitLimit > 1_000_000)
  ) {
    return jsonResponse(
      { error: "Capacity must be blank or a whole number from 1 to 1,000,000." },
      400,
    );
  }

  if (environment === "live" && salesStatus === "open") {
    const readiness = await evaluatePreorderLaunchReadiness();
    if (!readiness.ready) {
      return jsonResponse(
        {
          error: "Live sales cannot be opened until every launch safeguard passes.",
          blockers: readiness.blockers,
        },
        409,
      );
    }
  }

  try {
    const snapshot = await updatePreorderSalesControl({
      environment,
      salesStatus,
      unitLimit,
      updatedBy: user.email,
    });
    return jsonResponse({ status: "updated", snapshot });
  } catch (error) {
    console.error("Pre-order sales controls update failed", error);
    return jsonResponse(
      { error: "Sales controls could not be updated. Please try again." },
      503,
    );
  }
}
