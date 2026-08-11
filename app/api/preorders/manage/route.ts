import {
  customerPreorderResponse,
  getCustomerManagedPreorder,
  requestPreorderAddressChange,
  requestPreorderCancellation,
  requestPreorderContactEmailChange,
  respondToPreorderDeliveryUpdate,
} from "@/lib/preorder-customer-management.server";
import { processExpiredPreorderDeliveryUpdate } from "@/lib/preorder-delivery-expiration.server";
import {
  preorderManagePreviewMutation,
  preorderManagePreviewOrder,
} from "@/lib/preorder-manage-preview";
import { isAllowedPreorderUsState } from "@/lib/preorder-shipping";
import {
  isLocalPreorderPreview,
} from "@/lib/runtime-env.server";
import { consumePreorderRateLimit } from "@/lib/preorder-rate-limit.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const US_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;
const VALID_ACTIONS = new Set([
  "request_email_change",
  "request_address_change",
  "respond_delivery_update",
  "request_cancellation",
]);

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("preview") === "1" && (await isLocalPreorderPreview(request))) {
    return response({
      status: "ready",
      order: preorderManagePreviewOrder(url.searchParams.get("state")),
    });
  }
  const token = url.searchParams.get("token") ?? "";
  try {
    const rateLimit = await consumePreorderRateLimit({
      request,
      scope: "preorder_manage_lookup",
      limit: 60,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many order lookups. Please wait and try again." }),
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Type": "application/json; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const order = await getCustomerManagedPreorder(token);
    if (!order) {
      return response({ error: "This order-management link is invalid or expired." }, 404);
    }
    return response({ status: "ready", order: customerPreorderResponse(order) });
  } catch (error) {
    console.error("Customer pre-order lookup failed", error);
    return response(
      { error: "Your order details are temporarily unavailable. Please try again." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return response({ error: "Request origin is not allowed." }, 403);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return response({ error: "Request is too large." }, 413);
  }

  let payload: {
    action?: unknown;
    token?: unknown;
    reason?: unknown;
    shippingAddress?: unknown;
    email?: unknown;
    deliveryUpdateVersion?: unknown;
    response?: unknown;
    preview?: unknown;
    previewState?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return response({ error: "The order request is invalid." }, 400);
  }
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!VALID_ACTIONS.has(action)) {
    return response({ error: "Choose a valid order action." }, 400);
  }
  const token = typeof payload.token === "string" ? payload.token : "";
  const reason =
    typeof payload.reason === "string"
      ? payload.reason.trim().replace(/\s+/g, " ").slice(0, 1_000) || null
      : null;

  try {
    if (payload.preview === true && (await isLocalPreorderPreview(request))) {
      const previewResult = preorderManagePreviewMutation({
        action,
        state: payload.previewState,
        email: payload.email,
        shippingAddress: payload.shippingAddress,
        response: payload.response,
      });
      if (!previewResult) return response({ error: "Choose a valid order action." }, 400);
      return response(previewResult);
    }
    const rateLimit = await consumePreorderRateLimit({
      request,
      scope: "preorder_manage_mutation",
      limit: 10,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many order-update attempts. Please wait before trying again.",
        }),
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Type": "application/json; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    if (action === "request_email_change") {
      const email =
        typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      if (
        !email ||
        email.length > 254 ||
        !EMAIL_PATTERN.test(email) ||
        email.includes("..")
      ) {
        return response({ error: "Enter a valid email address." }, 400);
      }
      const result = await requestPreorderContactEmailChange({
        origin: new URL(request.url).origin,
        token,
        email,
      });
      if (result.status === "invalid") {
        return response({ error: "This order-management link is invalid or expired." }, 404);
      }
      return response({
        status:
          result.status === "unchanged"
            ? "email_unchanged"
            : "email_verification_sent",
        order: customerPreorderResponse(result.order),
      });
    }
    if (action === "request_address_change") {
      const address =
        payload.shippingAddress && typeof payload.shippingAddress === "object"
          ? (payload.shippingAddress as Record<string, unknown>)
          : null;
      const cleanAddressField = (key: string, maxLength: number) =>
        typeof address?.[key] === "string"
          ? (address[key] as string).trim().replace(/\s+/g, " ").slice(0, maxLength)
          : "";
      const shippingAddress = {
        line1: cleanAddressField("line1", 200),
        line2: cleanAddressField("line2", 200),
        city: cleanAddressField("city", 100),
        state: cleanAddressField("state", 2).toUpperCase(),
        postal_code: cleanAddressField("postal_code", 20),
        country: cleanAddressField("country", 2).toUpperCase(),
      };
      if (
        shippingAddress.line1.length < 3 ||
        shippingAddress.city.length < 2 ||
        !isAllowedPreorderUsState(shippingAddress.state) ||
        !US_ZIP_PATTERN.test(shippingAddress.postal_code) ||
        shippingAddress.country !== "US"
      ) {
        return response(
          { error: "Enter a complete US shipping address with a valid state and ZIP code." },
          400,
        );
      }
      const result = await requestPreorderAddressChange({
        origin: new URL(request.url).origin,
        token,
        reason,
        shippingAddress,
      });
      if (result.status === "invalid") {
        return response({ error: "This order-management link is invalid or expired." }, 404);
      }
      if (result.status === "unavailable") {
        return response(
          {
            error: "This shipping address cannot be changed online right now. Please contact support.",
            order: customerPreorderResponse(result.order),
          },
          409,
        );
      }
      return response({
        status: "address_change_requested",
        order: customerPreorderResponse(result.order),
      });
    }

    if (action === "respond_delivery_update") {
      const deliveryUpdateVersion = Number(payload.deliveryUpdateVersion);
      const deliveryResponse =
        payload.response === "accept" || payload.response === "request_cancellation"
          ? payload.response
          : null;
      if (!Number.isSafeInteger(deliveryUpdateVersion) || deliveryUpdateVersion < 1 || !deliveryResponse) {
        return response({ error: "Choose how you want to respond to the delivery update." }, 400);
      }
      const result = await respondToPreorderDeliveryUpdate({
        origin: new URL(request.url).origin,
        token,
        deliveryUpdateVersion,
        response: deliveryResponse,
        reason,
      });
      if (result.status === "invalid") {
        return response({ error: "This order-management link is invalid or expired." }, 404);
      }
      if (result.status === "unavailable") {
        return response(
          {
            error: "This delivery update has already been answered or is no longer current.",
            order: customerPreorderResponse(result.order),
          },
          409,
        );
      }
      if (result.status === "deadline_expired") {
        try {
          await processExpiredPreorderDeliveryUpdate({
            origin: new URL(request.url).origin,
            orderId: result.order.id,
            deliveryUpdateVersion,
          });
        } catch (error) {
          console.error("Expired pre-order response could not be refunded immediately", error);
        }
        const latestOrder = await getCustomerManagedPreorder(token);
        return response(
          {
            error:
              "The response deadline has passed. The unshipped order is being cancelled and refunded automatically.",
            order: customerPreorderResponse(latestOrder ?? result.order),
          },
          409,
        );
      }
      return response({ status: result.status, order: customerPreorderResponse(result.order) });
    }

    if (action !== "request_cancellation") {
      return response({ error: "Choose a valid order action." }, 400);
    }

    const result = await requestPreorderCancellation({
      origin: new URL(request.url).origin,
      token,
      reason,
    });
    if (result.status === "invalid") {
      return response({ error: "This order-management link is invalid or expired." }, 404);
    }
    if (result.status === "unavailable") {
      return response(
        {
          error:
            "This pre-order cannot be cancelled through the online form. Please contact support.",
          order: customerPreorderResponse(result.order),
        },
        409,
      );
    }
    return response({
      status: "requested",
      order: customerPreorderResponse(result.order),
    });
  } catch (error) {
    console.error("Customer pre-order update request failed", error);
    return response(
      { error: "Your order request could not be submitted. Please try again." },
      503,
    );
  }
}
