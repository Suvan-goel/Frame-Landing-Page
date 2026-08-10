import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluatePreorderOperationsHealth,
  type PreorderOperationsHealthEmail,
  type PreorderOperationsHealthEnvironment,
  type PreorderOperationsHealthIntent,
  type PreorderOperationsHealthItem,
  type PreorderOperationsHealthOrder,
  type PreorderOperationsHealthResult,
  type PreorderOperationsHealthSalesSnapshot,
  type PreorderOperationsHealthWebhook,
} from "./preorder-operations-health";

const PAGE_SIZE = 500;
const MAX_ROWS_PER_SOURCE = 10_000;

function reservedTestAddress(value: unknown) {
  if (typeof value !== "string") return false;
  const domain = value.trim().toLowerCase().split("@").pop();
  return domain === "example.com" || domain === "example.net" || domain === "example.org";
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

async function loadPages(
  label: string,
  queryPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < MAX_ROWS_PER_SOURCE; offset += PAGE_SIZE) {
    const result = await queryPage(offset, offset + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`${label} exceeds the ${MAX_ROWS_PER_SOURCE}-row operations-health limit.`);
}

function mappedOrder(row: Record<string, unknown>): PreorderOperationsHealthOrder {
  return {
    id: String(row.id),
    orderNumber: Number(row.order_number),
    environment: row.environment as PreorderOperationsHealthEnvironment,
    orderStatus: String(row.order_status),
    paymentStatus: String(row.payment_status),
    fulfillmentStatus: String(row.fulfillment_status),
    cancellationStatus: String(row.cancellation_status),
    cancellationRequestedAt: stringOrNull(row.cancellation_requested_at),
    addressChangeStatus: String(row.address_change_status),
    addressChangeRequestedAt: stringOrNull(row.address_change_requested_at),
    deliveryUpdateStatus: String(row.delivery_update_status),
    deliveryUpdateResponseMode: String(row.delivery_update_response_mode),
    deliveryUpdateResponseDeadline: stringOrNull(row.delivery_update_response_deadline),
    confirmationEmailSentAt: stringOrNull(row.confirmation_email_sent_at),
    recipientIsReservedTestAddress: reservedTestAddress(row.email),
    amountTotal: Number(row.amount_total),
    amountRefunded: Number(row.amount_refunded),
    placedAt: String(row.placed_at),
    shippedAt: stringOrNull(row.shipped_at),
    deliveredAt: stringOrNull(row.delivered_at),
  };
}

function mappedEmail(row: Record<string, unknown>): PreorderOperationsHealthEmail {
  const recipient = String(row.recipient).trim().toLowerCase();
  return {
    id: String(row.id),
    preorderId: String(row.preorder_id),
    streamKey: `${String(row.preorder_id)}:${String(row.email_type)}:${recipient}`,
    emailType: String(row.email_type),
    status: String(row.status),
    recipientIsReservedTestAddress: reservedTestAddress(recipient),
    providerTrackingExpected: Boolean(row.provider_tracking_expected),
    lastEvent: stringOrNull(row.last_event),
    lastEventAt: stringOrNull(row.last_event_at),
    sentAt: stringOrNull(row.sent_at),
    deliveredAt: stringOrNull(row.delivered_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mappedWebhook(row: Record<string, unknown>): PreorderOperationsHealthWebhook {
  return {
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    livemode: Boolean(row.livemode),
    status: String(row.status),
    receivedAt: String(row.received_at),
    lastAttemptedAt: stringOrNull(row.last_attempted_at),
  };
}

function mappedItem(row: Record<string, unknown>): PreorderOperationsHealthItem {
  return {
    id: String(row.id),
    preorderId: String(row.preorder_id),
    quantity: Number(row.quantity),
  };
}

function mappedIntent(row: Record<string, unknown>): PreorderOperationsHealthIntent {
  return {
    id: String(row.id),
    environment: row.environment as PreorderOperationsHealthEnvironment,
    status: String(row.status),
    quantity: Number(row.quantity),
    expiresAt: stringOrNull(row.expires_at),
  };
}

function mappedSales(row: Record<string, unknown>): PreorderOperationsHealthSalesSnapshot {
  return {
    environment: row.environment as PreorderOperationsHealthEnvironment,
    salesStatus: String(row.sales_status),
    inventoryLimit: Number(row.inventory_limit),
    unitLimit: Number(row.unit_limit),
    paidUnits: Number(row.paid_units),
    reservedUnits: Number(row.reserved_units),
    remainingUnits: Number(row.remaining_units),
    inventoryRemainingUnits: Number(row.inventory_remaining_units),
  };
}

export async function runPreorderOperationsHealth(input: {
  supabase: SupabaseClient;
  environment: PreorderOperationsHealthEnvironment;
  now?: Date;
}): Promise<PreorderOperationsHealthResult> {
  const livemode = input.environment === "live";
  const [orders, emails, webhooks, items, intents, salesResult] = await Promise.all([
    loadPages("preorders", (from, to) =>
      input.supabase
        .from("preorders")
        .select("id,order_number,environment,email,order_status,payment_status,fulfillment_status,cancellation_status,cancellation_requested_at,address_change_status,address_change_requested_at,delivery_update_status,delivery_update_response_mode,delivery_update_response_deadline,confirmation_email_sent_at,amount_total,amount_refunded,placed_at,shipped_at,delivered_at")
        .eq("environment", input.environment)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadPages("preorder email deliveries", (from, to) =>
      input.supabase
        .from("preorder_email_deliveries")
        .select("id,preorder_id,email_type,recipient,status,provider_tracking_expected,last_event,last_event_at,sent_at,delivered_at,created_at,updated_at,preorders!inner(environment)")
        .eq("preorders.environment", input.environment)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadPages("Stripe webhook recovery records", (from, to) =>
      input.supabase
        .from("stripe_webhook_events")
        .select("event_id,event_type,livemode,status,received_at,last_attempted_at")
        .eq("livemode", livemode)
        .in("status", ["failed", "processing"])
        .order("event_id", { ascending: true })
        .range(from, to),
    ),
    loadPages("pre-order inventory items", (from, to) =>
      input.supabase
        .from("preorder_order_items")
        .select("id,preorder_id,quantity,preorders!inner(environment)")
        .eq("preorders.environment", input.environment)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadPages("pre-order checkout reservations", (from, to) =>
      input.supabase
        .from("preorder_checkout_intents")
        .select("id,environment,status,quantity,expires_at")
        .eq("environment", input.environment)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    input.supabase.rpc("get_preorder_sales_snapshot", {
      p_environment: input.environment,
    }),
  ]);
  if (salesResult.error) throw new Error(salesResult.error.message);
  const salesRow = (salesResult.data as Record<string, unknown>[] | null)?.[0];
  if (!salesRow) {
    throw new Error(`Pre-order ${input.environment} sales controls are not configured.`);
  }

  return evaluatePreorderOperationsHealth({
    environment: input.environment,
    now: (input.now ?? new Date()).toISOString(),
    orders: orders.map(mappedOrder),
    emails: emails.map(mappedEmail),
    webhooks: webhooks.map(mappedWebhook),
    items: items.map(mappedItem),
    intents: intents.map(mappedIntent),
    sales: mappedSales(salesRow),
  });
}
