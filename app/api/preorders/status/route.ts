import { fulfillPreorderCheckout } from "@/lib/preorder-payments.server";
import {
  formatPreorderNumber,
  PREORDER_DEFAULT_CURRENCY,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_REMAINING_BALANCE_CENTS,
  PREORDER_ESTIMATED_SHIPPING,
  PREORDER_SHIPPING_RATE_CENTS,
} from "@/lib/preorder";
import {
  isLocalPreorderPreview,
  isPreorderSalesRequestEnabled,
} from "@/lib/runtime-env.server";
import { getStripe } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { createPreorderManagePath } from "@/lib/preorder-order-access.server";
import { consumePreorderRateLimit } from "@/lib/preorder-rate-limit.server";
import { publicPreorderShippingAddress } from "@/lib/preorder-confirmation";

export const dynamic = "force-dynamic";

type StoredOrder = {
  id: string;
  order_number: number;
  full_name: string;
  email: string;
  shipping_address: Record<string, unknown>;
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
  offer_type: "full_preorder" | "reservation";
  reservation_amount: number | null;
  locked_total_price: number | null;
  remaining_balance: number | null;
  reservation_status: string | null;
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
      shippingAddress: publicPreorderShippingAddress(order.shipping_address),
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
      offerType: order.offer_type,
      reservationAmountCents: order.reservation_amount,
      lockedTotalPriceCents: order.locked_total_price,
      remainingBalanceCents: order.remaining_balance,
      reservationStatus: order.reservation_status,
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
        shippingAddress: {
          line1: "1450 Market Street",
          city: "San Francisco",
          state: "CA",
          postalCode: "94102",
          country: "US",
        },
        quantity: 1,
        amountSubtotalCents: PREORDER_DEFAULT_PRICE_CENTS,
        amountShippingCents: PREORDER_SHIPPING_RATE_CENTS,
        amountTaxCents: 0,
        amountPaidCents: PREORDER_DEFAULT_PRICE_CENTS + PREORDER_SHIPPING_RATE_CENTS,
        currency: PREORDER_DEFAULT_CURRENCY,
        placedAt: new Date().toISOString(),
        estimatedShipping: PREORDER_ESTIMATED_SHIPPING,
        fulfillmentStatus: "on_hold",
        managePath: "/preorder/manage?preview=1",
        offerType: "reservation",
        reservationAmountCents: PREORDER_DEFAULT_PRICE_CENTS,
        lockedTotalPriceCents: PREORDER_FOUNDING_PRICE_CENTS,
        remainingBalanceCents: PREORDER_REMAINING_BALANCE_CENTS,
        reservationStatus: "active",
      },
    });
  }

  const sessionId = url.searchParams.get("session_id") ?? "";
  if (!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return response({ status: "invalid", error: "Payment confirmation reference is invalid." }, 400);
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
        JSON.stringify({
          status: "rate_limited",
          error: "Too many confirmation checks. Please wait and try again.",
        }),
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
      .select("id,order_number,full_name,email,shipping_address,payment_status,fulfillment_status,amount_subtotal,amount_shipping,amount_tax,amount_total,currency,estimated_delivery,placed_at,manage_token_version,offer_type,reservation_amount,locked_total_price,remaining_balance,reservation_status")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle<StoredOrder>();
    if (stored.error) throw stored.error;
    if (stored.data) return response(await orderResponse(stored.data));

    const environment = sessionId.startsWith("cs_live_") ? "live" : "test";
    const stripe = await getStripe(environment);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!["frame_preorder", "frame_reservation"].includes(session.metadata?.flow ?? "")) {
      return response({ status: "invalid", error: "Payment reference is not a Frame reservation." }, 400);
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
    return response({
      status: "unavailable",
      error: "Payment confirmation is temporarily unavailable.",
    }, 503);
  }
}
