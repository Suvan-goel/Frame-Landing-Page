import { getChatGPTUser } from "@/app/chatgpt-auth";
import { evaluatePreorderLaunchReadiness } from "@/lib/preorder-launch-readiness.server";
import {
  updatePreorderSalesControl,
  type PreorderEnvironment,
  type PreorderSalesStatus,
} from "@/lib/preorder-operations.server";
import { PREORDER_MAX_INVENTORY_UNITS } from "@/lib/preorder";
import {
  isPreorderLiveSmokeConfigured,
  isPreorderPublicLaunchConfigured,
} from "@/lib/preorder-live-smoke-access";
import { evaluatePreorderLiveOpeningReadiness } from "@/lib/preorder-live-opening-readiness.server";
import { getRuntimeValue } from "@/lib/runtime-env.server";
import { getStripe } from "@/lib/stripe.server";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

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
  const unitLimit = Number(payload.unitLimit);
  if (
    !Number.isSafeInteger(unitLimit) ||
    unitLimit < 0 ||
    unitLimit > PREORDER_MAX_INVENTORY_UNITS
  ) {
    return jsonResponse(
      { error: "Released capacity must be a whole number from 0 to 1,000." },
      400,
    );
  }

  if (salesStatus === "open" && unitLimit < 1) {
    return jsonResponse(
      { error: "Release at least one unit before opening checkout." },
      400,
    );
  }

  if (environment === "live" && salesStatus === "open") {
    const [readiness, mode, publicLaunchEnabled, verifiedOrderId, liveSmokeSecret] =
      await Promise.all([
        evaluatePreorderLaunchReadiness(),
        getRuntimeValue("PREORDER_MODE"),
        getRuntimeValue("PREORDER_PUBLIC_LAUNCH_ENABLED"),
        getRuntimeValue("PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID"),
        getRuntimeValue("PREORDER_LIVE_SMOKE_ACCESS_SECRET"),
      ]);
    if (!readiness.ready) {
      return jsonResponse(
        {
          error: "Live sales cannot be opened until every launch safeguard passes.",
          blockers: readiness.blockers,
        },
        409,
      );
    }

    try {
      const [supabase, stripe] = await Promise.all([
        getSupabaseAdmin(),
        getStripe("live"),
      ]);
      const openingReadiness = await evaluatePreorderLiveOpeningReadiness({
        supabase,
        stripe,
        publicLaunchEnabled,
        verifiedOrderId,
      });
      if (!openingReadiness.ready) {
        return jsonResponse(
          {
            error:
              "Live sales cannot be opened while payment, operational, or verification evidence is incomplete.",
            blockers: openingReadiness.blockers,
          },
          409,
        );
      }
    } catch (error) {
      console.error("Pre-order live opening safeguard failed", error);
      return jsonResponse(
        {
          error:
            "Live sales cannot be opened because the final payment and operations safeguards could not be verified.",
        },
        503,
      );
    }

    const publicLaunchConfigured = isPreorderPublicLaunchConfigured({
      enabled: publicLaunchEnabled,
      verifiedOrderId,
    });
    if (!publicLaunchConfigured) {
      if (publicLaunchEnabled === "true") {
        return jsonResponse(
          {
            error:
              "Public launch remains locked until the fully refunded live verification order ID is configured.",
          },
          409,
        );
      }
      if (
        !isPreorderLiveSmokeConfigured({
          mode,
          publicLaunchEnabled,
          verifiedOrderId,
          secret: liveSmokeSecret,
        })
      ) {
        return jsonResponse(
          {
            error:
              "Configure the private live-verification gate before opening a non-public live allocation.",
          },
          409,
        );
      }
      if (unitLimit !== 1) {
        return jsonResponse(
          {
            error:
              "Private live verification may open exactly one released unit. Keep public launch disabled until that order is verified and refunded.",
          },
          409,
        );
      }
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
    if (
      error instanceof Error &&
      error.message.includes("cannot be lower than paid units")
    ) {
      return jsonResponse({ error: error.message }, 409);
    }
    return jsonResponse(
      { error: "Sales controls could not be updated. Please try again." },
      503,
    );
  }
}
