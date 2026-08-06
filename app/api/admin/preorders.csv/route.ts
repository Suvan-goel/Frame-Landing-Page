import { getChatGPTUser } from "@/app/chatgpt-auth";
import { formatPreorderNumber } from "@/lib/preorder";
import type { PreorderEnvironment } from "@/lib/preorder-operations.server";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type ExportOrder = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  full_name: string;
  email: string;
  phone: string | null;
  shipping_address: Record<string, unknown>;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  cancellation_status: string;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  terms_version: string;
  product_status_version: string;
  marketing_opt_in: boolean;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  placed_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

type ExportItem = {
  preorder_id: string;
  sku: string;
  product_name: string;
  quantity: number;
};

type ExportPayment = {
  preorder_id: string;
  stripe_payment_intent_id: string | null;
};

function csvCell(value: string | number | boolean | null) {
  let safeValue = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function addressValue(address: Record<string, unknown>, key: string) {
  const value = address[key];
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!(await isWaitlistAdmin(user.email))) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const requestedEnvironment = new URL(request.url).searchParams.get("environment");
  const environment: PreorderEnvironment =
    requestedEnvironment === "live" ? "live" : "test";
  const supabase = await getSupabaseAdmin();
  const ordersResult = await supabase
    .from("preorders")
    .select("id,order_number,environment,full_name,email,phone,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,cancellation_requested_at,cancellation_reason,amount_total,amount_refunded,currency,estimated_delivery,terms_version,product_status_version,marketing_opt_in,carrier,tracking_number,tracking_url,placed_at,shipped_at,delivered_at")
    .eq("environment", environment)
    .order("order_number", { ascending: false })
    .limit(10_000)
    .returns<ExportOrder[]>();
  if (ordersResult.error) {
    console.error("Pre-order CSV query failed", ordersResult.error);
    return Response.json(
      { error: "The pre-order export is temporarily unavailable." },
      { status: 503 },
    );
  }

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  let items: ExportItem[] = [];
  let payments: ExportPayment[] = [];
  if (orderIds.length) {
    const [itemsResult, paymentsResult] = await Promise.all([
      supabase
        .from("preorder_order_items")
        .select("preorder_id,sku,product_name,quantity")
        .in("preorder_id", orderIds)
        .returns<ExportItem[]>(),
      supabase
        .from("preorder_payments")
        .select("preorder_id,stripe_payment_intent_id")
        .in("preorder_id", orderIds)
        .returns<ExportPayment[]>(),
    ]);
    if (itemsResult.error || paymentsResult.error) {
      console.error("Pre-order CSV details query failed", {
        items: itemsResult.error,
        payments: paymentsResult.error,
      });
      return Response.json(
        { error: "The pre-order export is temporarily unavailable." },
        { status: 503 },
      );
    }
    items = itemsResult.data ?? [];
    payments = paymentsResult.data ?? [];
  }

  const itemByOrder = new Map(items.map((item) => [item.preorder_id, item]));
  const paymentByOrder = new Map(
    payments.map((payment) => [payment.preorder_id, payment]),
  );
  const rows: Array<Array<string | number | boolean | null>> = [
    [
      "order_number", "environment", "placed_at", "order_status",
      "payment_status", "fulfillment_status", "cancellation_status",
      "cancellation_requested_at", "cancellation_reason", "full_name", "email",
      "phone", "address_line_1", "address_line_2", "city", "state",
      "postal_code", "country", "product", "sku", "quantity",
      "amount_total_minor_units", "amount_refunded_minor_units", "currency",
      "estimated_delivery", "carrier", "tracking_number", "tracking_url",
      "shipped_at", "delivered_at", "stripe_payment_intent_id", "terms_version",
      "product_status_version", "marketing_opt_in",
    ],
    ...orders.map((order) => {
      const item = itemByOrder.get(order.id);
      const payment = paymentByOrder.get(order.id);
      return [
        formatPreorderNumber(order.order_number), order.environment, order.placed_at,
        order.order_status, order.payment_status, order.fulfillment_status,
        order.cancellation_status, order.cancellation_requested_at,
        order.cancellation_reason, order.full_name, order.email, order.phone,
        addressValue(order.shipping_address, "line1"),
        addressValue(order.shipping_address, "line2"),
        addressValue(order.shipping_address, "city"),
        addressValue(order.shipping_address, "state"),
        addressValue(order.shipping_address, "postal_code"),
        addressValue(order.shipping_address, "country"),
        item?.product_name ?? null, item?.sku ?? null, item?.quantity ?? null,
        order.amount_total, order.amount_refunded, order.currency,
        order.estimated_delivery, order.carrier, order.tracking_number,
        order.tracking_url, order.shipped_at, order.delivered_at,
        payment?.stripe_payment_intent_id ?? null, order.terms_version,
        order.product_status_version, order.marketing_opt_in,
      ];
    }),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="frame-preorders-${environment}-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
