import {
  customerPreorderResponse,
  getCustomerManagedPreorder,
  requestPreorderAddressChange,
  requestPreorderCancellation,
  respondToPreorderDeliveryUpdate,
} from "@/lib/preorder-customer-management.server";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { consumePreorderRateLimit } from "@/lib/preorder-rate-limit.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;

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
  const token = new URL(request.url).searchParams.get("token") ?? "";
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
    deliveryUpdateVersion?: unknown;
    response?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return response({ error: "The order request is invalid." }, 400);
  }
  const action = typeof payload.action === "string" ? payload.action : "request_cancellation";
  const token = typeof payload.token === "string" ? payload.token : "";
  const reason =
    typeof payload.reason === "string"
      ? payload.reason.trim().replace(/\s+/g, " ").slice(0, 1_000) || null
      : null;

  try {
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
        state: cleanAddressField("state", 100),
        postal_code: cleanAddressField("postal_code", 20),
        country: cleanAddressField("country", 2).toUpperCase(),
      };
      const config = await getPreorderConfiguration();
      if (
        shippingAddress.line1.length < 3 ||
        shippingAddress.city.length < 2 ||
        shippingAddress.state.length < 2 ||
        shippingAddress.postal_code.length < 3 ||
        !config.allowedCountries.includes(shippingAddress.country)
      ) {
        return response(
          { error: "Enter a complete shipping address in an available country." },
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
