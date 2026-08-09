import { initiatePreorderFullRefund } from "./preorder-admin-operations.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

type ExpirableOrder = {
  id: string;
  delivery_update_version: number;
};

async function recordExpirationEvent(order: ExpirableOrder, deadline: string | null) {
  const supabase = await getSupabaseAdmin();
  const event = await supabase.from("preorder_events").upsert(
    {
      preorder_id: order.id,
      event_key: `preorder-order-change-deadline-expired-${order.id}-${order.delivery_update_version}`,
      event_type: "order_change_deadline_expired",
      source: "system",
      detail: {
        delivery_update_version: order.delivery_update_version,
        response_deadline: deadline,
        action: "automatic_cancellation_and_full_refund",
      },
    },
    { onConflict: "event_key", ignoreDuplicates: true },
  );
  if (event.error) throw event.error;
}

async function stageExpiredPreorderDeliveryUpdate(input: {
  orderId: string;
  deliveryUpdateVersion: number;
  now: string;
}) {
  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorders")
    .update({
      delivery_update_status: "expired",
      delivery_update_expired_at: input.now,
      cancellation_status: "requested",
      cancellation_requested_at: input.now,
      cancellation_reason:
        "Automatically cancelled because required consent was not received by the order-change deadline.",
      cancellation_resolved_at: null,
      cancellation_resolution_note: null,
      updated_at: input.now,
    })
    .eq("id", input.orderId)
    .eq("delivery_update_version", input.deliveryUpdateVersion)
    .eq("delivery_update_status", "pending")
    .eq("delivery_update_response_mode", "affirmative_consent_required")
    .lte("delivery_update_response_deadline", input.now)
    .eq("order_status", "placed")
    .eq("cancellation_status", "none")
    .in("payment_status", ["paid", "partially_refunded", "refund_failed"])
    .in("fulfillment_status", ["on_hold", "ready", "processing"])
    .select("id,delivery_update_version,delivery_update_response_deadline")
    .maybeSingle<
      ExpirableOrder & { delivery_update_response_deadline: string | null }
    >();
  if (updated.error) throw updated.error;
  if (!updated.data) return false;

  await recordExpirationEvent(
    updated.data,
    updated.data.delivery_update_response_deadline,
  );
  return true;
}

async function refundExpiredPreorderDeliveryUpdate(input: {
  origin: string;
  orderId: string;
  deliveryUpdateVersion: number;
}) {
  const supabase = await getSupabaseAdmin();
  const eligible = await supabase
    .from("preorders")
    .select("id,delivery_update_version")
    .eq("id", input.orderId)
    .eq("delivery_update_version", input.deliveryUpdateVersion)
    .eq("delivery_update_status", "expired")
    .eq("order_status", "placed")
    .eq("cancellation_status", "requested")
    .in("payment_status", ["paid", "partially_refunded", "refund_failed"])
    .in("fulfillment_status", ["on_hold", "ready", "processing"])
    .maybeSingle<ExpirableOrder>();
  if (eligible.error) throw eligible.error;
  if (!eligible.data) return "not_eligible" as const;

  await initiatePreorderFullRefund({
    origin: input.origin,
    orderId: eligible.data.id,
    requestKey: `delivery-consent-expired-${eligible.data.delivery_update_version}`,
    trigger: "delivery_consent_expired",
  });
  return "refund_started" as const;
}

export async function processExpiredPreorderDeliveryUpdate(input: {
  origin: string;
  orderId: string;
  deliveryUpdateVersion: number;
  now?: Date;
}) {
  const now = (input.now ?? new Date()).toISOString();
  const staged = await stageExpiredPreorderDeliveryUpdate({
    orderId: input.orderId,
    deliveryUpdateVersion: input.deliveryUpdateVersion,
    now,
  });
  const result = await refundExpiredPreorderDeliveryUpdate(input);
  return { staged, result };
}

export async function processExpiredPreorderDeliveryUpdates(input: {
  origin: string;
  batchSize?: number;
  now?: Date;
}) {
  const now = (input.now ?? new Date()).toISOString();
  const batchSize = Math.min(Math.max(input.batchSize ?? 25, 1), 100);
  const supabase = await getSupabaseAdmin();
  const [due, retryable] = await Promise.all([
    supabase
      .from("preorders")
      .select("id,delivery_update_version")
      .eq("delivery_update_status", "pending")
      .eq("delivery_update_response_mode", "affirmative_consent_required")
      .lte("delivery_update_response_deadline", now)
      .eq("order_status", "placed")
      .eq("cancellation_status", "none")
      .in("payment_status", ["paid", "partially_refunded", "refund_failed"])
      .in("fulfillment_status", ["on_hold", "ready", "processing"])
      .order("delivery_update_response_deadline", { ascending: true })
      .limit(batchSize)
      .returns<ExpirableOrder[]>(),
    supabase
      .from("preorders")
      .select("id,delivery_update_version")
      .eq("delivery_update_status", "expired")
      .eq("order_status", "placed")
      .eq("cancellation_status", "requested")
      .in("payment_status", ["paid", "partially_refunded", "refund_failed"])
      .in("fulfillment_status", ["on_hold", "ready", "processing"])
      .limit(batchSize)
      .returns<ExpirableOrder[]>(),
  ]);
  if (due.error) throw due.error;
  if (retryable.error) throw retryable.error;

  const orders = new Map<string, ExpirableOrder>();
  for (const order of [...(due.data ?? []), ...(retryable.data ?? [])]) {
    orders.set(`${order.id}:${order.delivery_update_version}`, order);
  }

  let refundsStarted = 0;
  const failures: Array<{
    orderId: string;
    deliveryUpdateVersion: number;
    error: string;
  }> = [];
  for (const order of [...orders.values()].slice(0, batchSize)) {
    try {
      const processed = await processExpiredPreorderDeliveryUpdate({
        origin: input.origin,
        orderId: order.id,
        deliveryUpdateVersion: order.delivery_update_version,
        now: new Date(now),
      });
      if (processed.result === "refund_started") refundsStarted += 1;
    } catch (error) {
      failures.push({
        orderId: order.id,
        deliveryUpdateVersion: order.delivery_update_version,
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      });
    }
  }

  return {
    examined: Math.min(orders.size, batchSize),
    refundsStarted,
    failures,
  };
}
