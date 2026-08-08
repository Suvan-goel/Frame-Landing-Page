import {
  resolvePreorderAddressChange,
  sendPreorderDeliveryUpdate,
  updatePreorderFulfillment,
} from "@/lib/preorder-admin-operations.server";
import {
  authorizePreorderAdminApi,
  isPreorderId,
} from "@/lib/preorder-admin-api.server";
import {
  PREORDER_DELIVERY_NOTICE_TYPES,
  type PreorderDeliveryNoticeType,
} from "@/lib/preorder-delivery-policy";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const fulfillmentStatuses = new Set([
  "on_hold",
  "ready",
  "processing",
  "shipped",
  "delivered",
  "returned",
]);
const deliveryNoticeTypes = new Set<string>(PREORDER_DELIVERY_NOTICE_TYPES);

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || null;
}

function cleanTrackingUrl(value: unknown) {
  const cleaned = cleanText(value, 500);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizePreorderAdminApi(request);
  if (!authorization.user) {
    return response({ error: authorization.error }, authorization.status);
  }
  const { id } = await params;
  if (!isPreorderId(id)) return response({ error: "Invalid pre-order." }, 400);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return response({ error: "Request is too large." }, 413);
  }

  let payload: {
    action?: unknown;
    fulfillmentStatus?: unknown;
    carrier?: unknown;
    trackingNumber?: unknown;
    trackingUrl?: unknown;
    ownerNote?: unknown;
    resolutionNote?: unknown;
    currentEstimate?: unknown;
    message?: unknown;
    noticeType?: unknown;
    responseDeadline?: unknown;
    shortDelayEligibilityConfirmed?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return response({ error: "Choose an order operation." }, 400);
  }

  try {
    if (payload.action === "update_fulfillment") {
      if (
        typeof payload.fulfillmentStatus !== "string" ||
        !fulfillmentStatuses.has(payload.fulfillmentStatus)
      ) {
        return response({ error: "Choose a valid fulfilment status." }, 400);
      }
      const trackingUrl = cleanTrackingUrl(payload.trackingUrl);
      if (cleanText(payload.trackingUrl, 500) && !trackingUrl) {
        return response({ error: "Tracking URL must be a valid HTTPS address." }, 400);
      }
      const result = await updatePreorderFulfillment({
        origin: new URL(request.url).origin,
        orderId: id,
        fulfillmentStatus: payload.fulfillmentStatus as
          | "on_hold"
          | "ready"
          | "processing"
          | "shipped"
          | "delivered"
          | "returned",
        carrier: cleanText(payload.carrier, 100),
        trackingNumber: cleanText(payload.trackingNumber, 200),
        trackingUrl,
        ownerNote: cleanText(payload.ownerNote, 2_000),
      });
      return response({ status: "updated", shippingEmail: result.shippingEmail });
    }

    if (
      payload.action === "approve_address_change" ||
      payload.action === "decline_address_change"
    ) {
      const approved = payload.action === "approve_address_change";
      const resolutionNote = cleanText(payload.resolutionNote, 1_000);
      if (!approved && !resolutionNote) {
        return response({ error: "Add a reason before declining the address change." }, 400);
      }
      const result = await resolvePreorderAddressChange({
        origin: new URL(request.url).origin,
        orderId: id,
        approved,
        resolutionNote,
      });
      return response({
        status: approved ? "approved" : "declined",
        customerEmail: result.customerEmail,
      });
    }

    if (payload.action === "send_delivery_update") {
      const currentEstimate = cleanText(payload.currentEstimate, 200);
      const message = cleanText(payload.message, 1_000);
      const noticeType = cleanText(payload.noticeType, 100);
      if (!currentEstimate || !message || !noticeType || !deliveryNoticeTypes.has(noticeType)) {
        return response({ error: "Choose the notice type and add the customer-facing details." }, 400);
      }
      const parsedDeadline =
        typeof payload.responseDeadline === "string" && payload.responseDeadline
          ? new Date(payload.responseDeadline)
          : null;
      if (parsedDeadline && !Number.isFinite(parsedDeadline.getTime())) {
        return response({ error: "Choose a valid customer-response deadline." }, 400);
      }
      const result = await sendPreorderDeliveryUpdate({
        origin: new URL(request.url).origin,
        orderId: id,
        noticeType: noticeType as PreorderDeliveryNoticeType,
        shortDelayEligibilityConfirmed:
          payload.shortDelayEligibilityConfirmed === true,
        currentEstimate,
        message,
        responseDeadline: parsedDeadline?.toISOString() ?? null,
      });
      return response({ status: "sent", customerEmail: result.customerEmail });
    }
    return response({ error: "Choose a valid order operation." }, 400);
  } catch (error) {
    console.error("Pre-order owner operation failed", error);
    const message = error instanceof Error ? error.message : "Order operation failed.";
    const expected =
      message.includes("cannot") ||
      message.includes("required") ||
      message.includes("cancellation request") ||
      message.includes("shipping-address request") ||
      message.includes("Delivery updates") ||
      message.includes("delivery estimate") ||
      message.includes("not found") ||
      message.includes("changed");
    return response(
      { error: expected ? message : "The order could not be updated. Please try again." },
      expected ? 409 : 503,
    );
  }
}
