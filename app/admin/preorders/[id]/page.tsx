/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { PreorderOrderOperations } from "@/app/components/preorder-order-operations";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { formatPreorderMoney, formatPreorderNumber } from "@/lib/preorder";
import { isPreorderId } from "@/lib/preorder-admin-api.server";
import { createPreorderManagePath } from "@/lib/preorder-order-access.server";
import type { PreorderEnvironment } from "@/lib/preorder-operations.server";
import {
  isPreorderAdminPageEnabled,
  isPreorderSalesPageEnabled,
} from "@/lib/preorder-sales-page.server";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type OrderDetail = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  manage_token_version: number;
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
  cancellation_resolved_at: string | null;
  cancellation_resolution_note: string | null;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  current_estimated_delivery: string;
  placed_at: string;
  address_change_status: string;
  address_change_requested_at: string | null;
  requested_shipping_address: Record<string, unknown> | null;
  address_change_reason: string | null;
  address_change_resolved_at: string | null;
  address_change_resolution_note: string | null;
  delivery_update_version: number;
  delivery_update_status: string;
  delivery_update_notice_type: string;
  delivery_update_response_mode: string;
  delivery_update_response_deadline: string | null;
  delivery_update_message: string | null;
  delivery_update_sent_at: string | null;
  delivery_update_acknowledged_at: string | null;
  delivery_update_expired_at: string | null;
  confirmation_email_sent_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  owner_note: string | null;
};

type OrderItem = { id: string; product_name: string; sku: string; quantity: number; unit_amount: number; currency: string };
type Payment = { id: string; stripe_payment_intent_id: string | null; amount_total: number; amount_refunded: number; currency: string; payment_status: string; paid_at: string | null; refunded_at: string | null };
type OrderEvent = { id: string; event_type: string; source: string; detail: Record<string, unknown>; created_at: string };
type EmailDelivery = {
  id: string;
  email_type: string;
  recipient: string;
  status: string;
  provider_tracking_expected: boolean;
  last_event: string | null;
  last_event_at: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

function dateTime(value: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function addressLines(address: Record<string, unknown>) {
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value));
}

export default async function PreorderOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuthenticatedOrderDetail id={id} />;
}

async function AuthenticatedOrderDetail({ id }: { id: string }) {
  if (!(await isPreorderAdminPageEnabled()) || !isPreorderId(id)) notFound();
  const user = await requireChatGPTUser(`/admin/preorders/${id}`);
  if (!(await isWaitlistAdmin(user.email))) notFound();
  const publicSalesPageEnabled = await isPreorderSalesPageEnabled();

  const supabase = await getSupabaseAdmin();
  const [orderResult, itemsResult, paymentsResult, eventsResult, emailsResult] = await Promise.all([
    supabase
      .from("preorders")
      .select("id,order_number,environment,manage_token_version,full_name,email,phone,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,cancellation_requested_at,cancellation_reason,cancellation_resolved_at,cancellation_resolution_note,amount_total,amount_refunded,currency,estimated_delivery,current_estimated_delivery,placed_at,address_change_status,address_change_requested_at,requested_shipping_address,address_change_reason,address_change_resolved_at,address_change_resolution_note,delivery_update_version,delivery_update_status,delivery_update_notice_type,delivery_update_response_mode,delivery_update_response_deadline,delivery_update_message,delivery_update_sent_at,delivery_update_acknowledged_at,delivery_update_expired_at,confirmation_email_sent_at,carrier,tracking_number,tracking_url,shipped_at,delivered_at,owner_note")
      .eq("id", id)
      .maybeSingle<OrderDetail>(),
    supabase.from("preorder_order_items").select("id,product_name,sku,quantity,unit_amount,currency").eq("preorder_id", id).returns<OrderItem[]>(),
    supabase.from("preorder_payments").select("id,stripe_payment_intent_id,amount_total,amount_refunded,currency,payment_status,paid_at,refunded_at").eq("preorder_id", id).returns<Payment[]>(),
    supabase.from("preorder_events").select("id,event_type,source,detail,created_at").eq("preorder_id", id).order("created_at", { ascending: false }).limit(100).returns<OrderEvent[]>(),
    supabase.from("preorder_email_deliveries").select("id,email_type,recipient,status,provider_tracking_expected,last_event,last_event_at,error_message,sent_at,delivered_at,created_at").eq("preorder_id", id).order("created_at", { ascending: false }).limit(50).returns<EmailDelivery[]>(),
  ]);
  if (orderResult.error) throw new Error("The pre-order is temporarily unavailable.");
  if (!orderResult.data) notFound();
  if (
    itemsResult.error ||
    paymentsResult.error ||
    eventsResult.error ||
    emailsResult.error
  ) {
    throw new Error("The pre-order history is temporarily unavailable.");
  }
  const order = orderResult.data;
  const emailRows = emailsResult.data ?? [];
  const confirmationDelivery = emailRows.find(
    (email) => email.email_type === "order_confirmation",
  );
  const adverseConfirmation = confirmationDelivery &&
    ["failed", "delayed", "bounced", "complained", "suppressed"].includes(
      confirmationDelivery.status,
    );
  const confirmationHeading = confirmationDelivery?.status === "delivered"
    ? "Confirmation delivered"
    : adverseConfirmation
      ? "Delivery needs attention"
      : confirmationDelivery?.provider_tracking_expected &&
          confirmationDelivery.status === "sent"
        ? "Awaiting delivery confirmation"
        : order.confirmation_email_sent_at
          ? "Confirmation sent"
          : "Needs attention";
  const payment = paymentsResult.data?.[0] ?? null;
  const amountRemaining = Math.max(order.amount_total - order.amount_refunded, 0);
  let managePath: string | null = null;
  try {
    managePath = publicSalesPageEnabled
      ? await createPreorderManagePath({ orderId: order.id, tokenVersion: order.manage_token_version })
      : null;
  } catch (error) {
    console.error("Owner order-management link creation failed", error);
  }
  const stripePaymentUrl = payment?.stripe_payment_intent_id
    ? `https://dashboard.stripe.com/${order.environment === "test" ? "test/" : ""}payments/${payment.stripe_payment_intent_id}`
    : null;

  return (
    <AdminDashboardShell
      activeSection="preorders"
      actions={
        <>
          <a className="button button--outline" href={`/admin/preorders?environment=${order.environment}`}>
            All pre-orders
          </a>
          {managePath ? (
            <a className="button button--dark" href={managePath} target="_blank" rel="noreferrer">
              Customer view
            </a>
          ) : null}
        </>
      }
      className="preorder-order-detail"
      description={`${order.full_name} · placed ${dateTime(order.placed_at)}`}
      eyebrow={`${order.environment === "test" ? "Sandbox" : "Live"} order`}
      title={formatPreorderNumber(order.order_number)}
      userEmail={user.email}
    >

        <section className="preorder-order-statuses" aria-label="Order statuses">
          <div><span>Order</span><strong>{order.order_status.replaceAll("_", " ")}</strong></div>
          <div><span>Payment</span><strong>{order.payment_status.replaceAll("_", " ")}</strong></div>
          <div><span>Fulfilment</span><strong>{order.fulfillment_status.replaceAll("_", " ")}</strong></div>
          <div><span>Cancellation</span><strong>{order.cancellation_status.replaceAll("_", " ")}</strong></div>
        </section>

        {order.cancellation_status !== "none" ? (
          <section className="preorder-order-cancellation-summary">
            <p className="eyebrow">Cancellation request</p>
            <h2>{order.cancellation_status.replaceAll("_", " ")}</h2>
            <p>{order.cancellation_reason || "No reason provided."}</p>
            <small>Requested {dateTime(order.cancellation_requested_at)}{order.cancellation_resolution_note ? ` · Resolution: ${order.cancellation_resolution_note}` : ""}</small>
          </section>
        ) : null}

        {order.address_change_status !== "none" ? (
          <section className="preorder-order-cancellation-summary">
            <p className="eyebrow">Shipping-address request</p>
            <h2>{order.address_change_status.replaceAll("_", " ")}</h2>
            {order.requested_shipping_address ? (
              <p>{addressLines(order.requested_shipping_address).join(" · ")}</p>
            ) : null}
            <small>
              Requested {dateTime(order.address_change_requested_at)}
              {order.address_change_reason ? ` · Customer note: ${order.address_change_reason}` : ""}
              {order.address_change_resolution_note ? ` · Resolution: ${order.address_change_resolution_note}` : ""}
            </small>
          </section>
        ) : null}

        <div className="preorder-order-layout">
          <div>
            <section className="preorder-owner-card">
              <p className="eyebrow">Customer</p>
              <h2>{order.full_name}</h2>
              <p><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone ? <><br />{order.phone}</> : null}</p>
              <p>{addressLines(order.shipping_address).map((line, index) => <span key={`${line}-${index}`}>{line}<br /></span>)}</p>
            </section>

            <section className="preorder-owner-card">
              <p className="eyebrow">Payment</p>
              <h2>{formatPreorderMoney(order.amount_total, order.currency)}</h2>
              <dl className="preorder-owner-facts">
                <div><dt>Refunded</dt><dd>{formatPreorderMoney(order.amount_refunded, order.currency)}</dd></div>
                <div><dt>Remaining</dt><dd>{formatPreorderMoney(amountRemaining, order.currency)}</dd></div>
                <div><dt>Paid</dt><dd>{dateTime(payment?.paid_at ?? null)}</dd></div>
              </dl>
              {stripePaymentUrl ? <a className="text-link" href={stripePaymentUrl} target="_blank" rel="noreferrer">Open payment in Stripe</a> : null}
            </section>

            <section className="preorder-owner-card">
              <p className="eyebrow">Items</p>
              {(itemsResult.data ?? []).map((item) => (
                <div className="preorder-owner-line-item" key={item.id}>
                  <div><h2>{item.product_name}</h2><p>{item.sku} · quantity {item.quantity}</p></div>
                  <strong>{formatPreorderMoney(item.unit_amount * item.quantity, item.currency)}</strong>
                </div>
              ))}
              <p><strong>Current estimated shipping:</strong> {order.current_estimated_delivery}</p>
              {order.current_estimated_delivery !== order.estimated_delivery ? (
                <p><strong>Original estimate:</strong> {order.estimated_delivery}</p>
              ) : null}
            </section>

            <PreorderOrderOperations
              orderId={order.id}
              environment={order.environment}
              amountRemainingLabel={formatPreorderMoney(amountRemaining, order.currency)}
              fulfillmentStatus={order.fulfillment_status}
              cancellationStatus={order.cancellation_status}
              addressChangeStatus={order.address_change_status}
              requestedShippingAddress={order.requested_shipping_address}
              addressChangeReason={order.address_change_reason}
              currentEstimatedDelivery={order.current_estimated_delivery}
              deliveryUpdateVersion={order.delivery_update_version}
              deliveryUpdateStatus={order.delivery_update_status}
              deliveryUpdateNoticeType={order.delivery_update_notice_type}
              deliveryUpdateResponseMode={order.delivery_update_response_mode}
              deliveryUpdateResponseDeadline={order.delivery_update_response_deadline}
              deliveryUpdateMessage={order.delivery_update_message}
              carrier={order.carrier}
              trackingNumber={order.tracking_number}
              trackingUrl={order.tracking_url}
              ownerNote={order.owner_note}
              canRefund={amountRemaining > 0 && ["paid", "partially_refunded", "refund_failed"].includes(order.payment_status)}
            />
          </div>

          <aside>
            <section className="preorder-owner-card">
              <p className="eyebrow">Email delivery</p>
              <h2>{confirmationHeading}</h2>
              <p>{confirmationDelivery?.status === "delivered" ? `Delivered to the recipient mail server ${dateTime(confirmationDelivery.delivered_at)}.` : order.confirmation_email_sent_at ? `Resend accepted the confirmation ${dateTime(order.confirmation_email_sent_at)}.` : "No successful confirmation is recorded."}</p>
              <ul className="preorder-owner-timeline">
                {emailRows.map((email) => <li key={email.id}><strong>{email.email_type.replaceAll("_", " ")}</strong><span>{email.status} · {email.last_event?.replace("email.", "").replaceAll("_", " ") ?? "local send"} · {dateTime(email.last_event_at ?? email.sent_at ?? email.created_at)}</span>{email.error_message ? <small>{email.error_message}</small> : null}</li>)}
              </ul>
            </section>

            <section className="preorder-owner-card">
              <p className="eyebrow">Order history</p>
              <ul className="preorder-owner-timeline">
                {(eventsResult.data ?? []).map((event) => <li key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.source} · {dateTime(event.created_at)}</span></li>)}
              </ul>
            </section>
          </aside>
        </div>
    </AdminDashboardShell>
  );
}
