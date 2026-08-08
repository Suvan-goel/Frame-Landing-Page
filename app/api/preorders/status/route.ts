import { fulfillPreorderCheckout } from "@/lib/preorder-payments.server";
import {
  formatPreorderNumber,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
} from "@/lib/preorder";
import {
  isLocalPreorderPreview,
  isPreorderSalesRequestEnabled,
} from "@/lib/runtime-env.server";
import { getStripe } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { createPreorderManagePath } from "@/lib/preorder-order-access.server";
import { consumePreorderRateLimit } from "@/lib/preorder-rate-limit.server";

export const dynamic = "force-dynamic";

type StoredOrder = {
  id: string;
  order_number: number;
  full_name: string;
  email: string;
  payment_status: string;
  fulfillment_status: string;
  amount_subtotal: number;
  amount_shipping: number;
  amount_tax: number;
  amount_total: number;
  currency: string;
  estimated_delivery: string;
  placed_at: string;
  manage_token_version: number;
};

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function orderResponse(order: StoredOrder) {
  const supabase = await getSupabaseAdmin();
  const item = await supabase
    .from("preorder_order_items")
    .select("quantity")
    .eq("preorder_id", order.id)
    .maybeSingle();
  if (item.error) throw item.error;
  let managePath: string | null = null;
  try {
    managePath = await createPreorderManagePath({
      orderId: order.id,
      tokenVersion: order.manage_token_version,
    });
  } catch (error) {
    console.error("Pre-order management link creation failed", error);
  }

  return {
    status: order.payment_status === "paid" ? "confirmed" : order.payment_status,
    order: {
      orderNumber: formatPreorderNumber(order.order_number),
      fullName: order.full_name,
      email: order.email,
      quantity: item.data?.quantity ?? 1,
      amountSubtotalCents: order.amount_subtotal,
      amountShippingCents: order.amount_shipping,
      amountTaxCents: order.amount_tax,
      amountPaidCents: order.amount_total,
      currency: order.currency,
      placedAt: order.placed_at,
      estimatedShipping: order.estimated_delivery,
      fulfillmentStatus: order.fulfillment_status,
      managePath,
    },
  };
}

export async function GET(request: Request) {
  if (!(await isPreorderSalesRequestEnabled(request))) {
    return response({ error: "Not found." }, 404);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("preview") === "1" && (await isLocalPreorderPreview(request))) {
    return response({
      status: "confirmed",
      order: {
        orderNumber: "FR-TEST-0001",
        fullName: "Test customer",
        email: "test@example.com",
        quantity: 1,
        amountSubtotalCents: PREORDER_DEFAULT_PRICE_CENTS,
        amountShippingCents: 0,
        amountTaxCents: 0,
        amountPaidCents: PREORDER_DEFAULT_PRICE_CENTS,
        currency: PREORDER_DEFAULT_CURRENCY,
        placedAt: new Date().toISOString(),
        estimatedShipping: PREORDER_ESTIMATED_SHIPPING,
        fulfillmentStatus: "on_hold",
      },
    });
  }

  const sessionId = url.searchParams.get("session_id") ?? "";
  if (!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return response({ error: "A valid payment confirmation reference is required." }, 400);
  }

  try {
    const rateLimit = await consumePreorderRateLimit({
      request,
      scope: "preorder_status",
      limit: 60,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many confirmation checks. Please wait and try again." }),
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    const supabase = await getSupabaseAdmin();
    const stored = await supabase
      .from("preorders")
      .select("id,order_number,full_name,email,payment_status,fulfillment_status,amount_subtotal,amount_shipping,amount_tax,amount_total,currency,estimated_delivery,placed_at,manage_token_version")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle<StoredOrder>();
    if (stored.error) throw stored.error;
    if (stored.data) return response(await orderResponse(stored.data));

    const environment = sessionId.startsWith("cs_live_") ? "live" : "test";
    const stripe = await getStripe(environment);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.flow !== "frame_preorder") {
      return response({ error: "Payment reference is not a Frame pre-order." }, 400);
    }
    if (session.payment_status === "paid") {
      const fulfilled = await fulfillPreorderCheckout(session, new URL(request.url).origin);
      return response(await orderResponse(fulfilled as StoredOrder));
    }
    return response({
      status: session.status === "expired" ? "expired" : "unpaid",
    });
  } catch (error) {
    console.error("Pre-order payment status failed", error);
    return response({ error: "Payment confirmation is temporarily unavailable." }, 503);
  }
}
