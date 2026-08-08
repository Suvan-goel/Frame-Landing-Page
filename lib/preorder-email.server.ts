import { getSupabaseAdmin } from "./supabase-admin.server";
import { getRuntimeValue } from "./runtime-env.server";
import { formatPreorderMoney, formatPreorderNumber } from "./preorder";
import { SITE_URL } from "./site";
import type { PreorderEnvironment } from "./preorder-operations.server";

export type RenderedAutomatedEmail = {
  subject: string;
  text: string;
  html: string;
};

export type PreorderConfirmationEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  amountSubtotal: number;
  amountShipping: number;
  amountTax: number;
  amountTotal: number;
  currency: string;
  quantity: number;
  placedAt: string;
  estimatedShipping: string;
  shippingAddress: Record<string, unknown>;
  managePath?: string | null;
  deliveryKey?: string;
};

export type PreorderShippingEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  managePath?: string | null;
};

export type PreorderOwnerActionEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  fullName: string;
  customerEmail: string;
  requestType: "cancellation" | "address_change";
  reason: string | null;
  requestedAddress?: Record<string, unknown> | null;
  deliveryKey: string;
};

export type PreorderAddressChangeResolutionEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  approved: boolean;
  resolutionNote: string | null;
  shippingAddress: Record<string, unknown>;
  managePath: string;
  resolutionVersion: string;
};

export type PreorderDeliveryUpdateEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  previousEstimate: string;
  currentEstimate: string;
  message: string;
  managePath: string;
  deliveryUpdateVersion: number;
};

export type PreorderRefundUpdateEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  amountRefunded: number;
  currency: string;
  status: "processing" | "completed";
  managePath: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addressLines(address: Record<string, unknown>) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .map((value) => value.trim());
}

async function sendPreorderEmail(input: {
  preorderId: string;
  emailType:
    | "order_confirmation"
    | "shipping_update"
    | "owner_action_required"
    | "cancellation_declined"
    | "address_change_resolved"
    | "delivery_update"
    | "refund_update";
  recipient: string;
  deliveryKey: string;
  subject: string;
  text: string;
  html: string;
}) {
  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const queued = await supabase
    .from("preorder_email_deliveries")
    .insert({
      preorder_id: input.preorderId,
      email_type: input.emailType,
      recipient: input.recipient,
      delivery_key: input.deliveryKey,
      status: "pending",
      error_message: null,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();
  if (queued.error && queued.error.code !== "23505") throw queued.error;

  let providerIdempotencyKey = input.deliveryKey;
  if (!queued.data) {
    const existing = await supabase
      .from("preorder_email_deliveries")
      .select("status,sent_at,updated_at")
      .eq("delivery_key", input.deliveryKey)
      .single();
    if (existing.error) throw existing.error;
    if (existing.data.status === "sent") return existing.data.sent_at as string;
    if (existing.data.status === "pending") return existing.data.sent_at as string | null;

    const retryQueued = await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "pending",
        error_message: null,
        updated_at: now,
      })
      .eq("delivery_key", input.deliveryKey)
      .eq("status", "failed")
      .eq("updated_at", existing.data.updated_at)
      .select("id")
      .maybeSingle();
    if (retryQueued.error) throw retryQueued.error;
    if (!retryQueued.data) return existing.data.sent_at as string | null;

    providerIdempotencyKey = `${input.deliveryKey}-retry-${crypto.randomUUID()}`;
  }

  const apiKey = await getRuntimeValue("RESEND_API_KEY");
  if (!apiKey) {
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: "Pre-order email delivery is not configured yet.",
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw new Error("Pre-order email delivery is not configured yet.");
  }

  const from =
    (await getRuntimeValue("PREORDER_FROM_EMAIL")) ??
    "Frame Pre-orders <preorders@framewearable.com>";
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": providerIdempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email provider request failed.";
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw new Error(`Pre-order email failed: ${detail.slice(0, 240)}`);
  }

  const result = (await response.json().catch(() => ({}))) as { id?: string };
  const sentAt = new Date().toISOString();
  const delivered = await supabase
    .from("preorder_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: result.id ?? null,
      sent_at: sentAt,
      error_message: null,
      updated_at: sentAt,
    })
    .eq("delivery_key", input.deliveryKey);
  if (delivered.error) throw delivered.error;
  return sentAt;
}

async function preorderOperationsRecipient() {
  const dedicated = await getRuntimeValue("PREORDER_OPERATIONS_EMAIL");
  if (dedicated?.trim()) return dedicated.trim().toLowerCase();
  const adminEmails = await getRuntimeValue("WAITLIST_ADMIN_EMAILS");
  return adminEmails
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) ?? null;
}

export function renderPreorderConfirmationEmail(
  input: PreorderConfirmationEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const subtotal = formatPreorderMoney(input.amountSubtotal, input.currency);
  const shippingAmount = formatPreorderMoney(input.amountShipping, input.currency);
  const taxAmount = formatPreorderMoney(input.amountTax, input.currency);
  const amount = formatPreorderMoney(input.amountTotal, input.currency);
  const placedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(input.placedAt),
  );
  const shipping = addressLines(input.shippingAddress);
  const termsUrl = `${SITE_URL}/preorder/terms`;
  const refundsUrl = `${SITE_URL}/preorder/refunds`;
  const productStatusUrl = `${SITE_URL}/preorder/product-status`;
  const manageUrl = input.managePath ? `${SITE_URL}${input.managePath}` : null;
  const sandbox = input.environment === "test";
  const subject = `${sandbox ? "[Sandbox] " : ""}Frame pre-order confirmation — ${orderNumber}`;
  const sandboxText = sandbox
    ? ["", "Sandbox order: no live charge was made."]
    : [];

  return {
    subject,
    text: [
      `Hello ${input.fullName},`,
      "",
      `Your Frame pre-order is confirmed. Order ${orderNumber}.`,
      `Product subtotal: ${subtotal}`,
      `Shipping: ${shippingAmount}`,
      `Sales tax: ${taxAmount}`,
      `Total paid: ${amount}`,
      `Quantity: ${input.quantity}`,
      `Placed: ${placedAt}`,
      `Estimated shipping: ${input.estimatedShipping}`,
      "Frame remains under development and is not currently FDA cleared or approved. It is not for medical decisions.",
      "",
      "Shipping address:",
      ...shipping,
      ...sandboxText,
      "",
      ...(manageUrl ? [`Manage your pre-order: ${manageUrl}`] : []),
      `Product status disclosure: ${productStatusUrl}`,
      `Pre-order terms: ${termsUrl}`,
      `Cancellation and refunds: ${refundsUrl}`,
      "",
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}Pre-order ${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Your Frame pre-order is confirmed.</h1>
        <p>Hello ${escapeHtml(input.fullName)}. We’ve received your payment and recorded your place in the pre-order queue.</p>
        <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
          <p style="margin:0 0 8px"><strong>Product subtotal:</strong> ${escapeHtml(subtotal)}</p>
          <p style="margin:0 0 8px"><strong>Shipping:</strong> ${escapeHtml(shippingAmount)}</p>
          <p style="margin:0 0 8px"><strong>Sales tax:</strong> ${escapeHtml(taxAmount)}</p>
          <p style="margin:0 0 8px"><strong>Total paid:</strong> ${escapeHtml(amount)}</p>
          <p style="margin:0 0 8px"><strong>Quantity:</strong> ${input.quantity}</p>
          <p style="margin:0"><strong>Placed:</strong> ${escapeHtml(placedAt)}</p>
        </div>
        <p><strong>Estimated shipping:</strong> ${escapeHtml(input.estimatedShipping)}</p>
        <p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Frame remains under development.</strong> It is not currently FDA cleared or approved and is not for medical decisions. You may cancel for a full refund at any time before dispatch.</p>
        <p><strong>Shipping address</strong><br>${shipping.map(escapeHtml).join("<br>")}</p>
        ${sandbox ? '<p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Sandbox order.</strong> No live charge was made.</p>' : ""}
        ${manageUrl ? `<p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Manage your pre-order</a></p>` : ""}
        <p><a href="${escapeHtml(productStatusUrl)}">Product status</a> · <a href="${escapeHtml(termsUrl)}">Pre-order terms</a> · <a href="${escapeHtml(refundsUrl)}">Cancellation and refunds</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  };
}

export async function sendPreorderConfirmationEmail(
  input: PreorderConfirmationEmailInput,
) {
  const deliveryKey =
    input.deliveryKey ?? `preorder-confirmation-${input.preorderId}`;
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "order_confirmation",
    recipient: input.email,
    deliveryKey,
    ...renderPreorderConfirmationEmail(input),
  });
}

export function renderPreorderShippingEmail(
  input: PreorderShippingEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = input.managePath ? `${SITE_URL}${input.managePath}` : null;
  const trackingText = [
    input.carrier ? `Carrier: ${input.carrier}` : null,
    input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : null,
    input.trackingUrl ? `Track your shipment: ${input.trackingUrl}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Your Frame pre-order has shipped — ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      `Your Frame pre-order ${orderNumber} has shipped.`,
      ...trackingText,
      ...(manageUrl ? ["", `View your order: ${manageUrl}`] : []),
      "",
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Your Frame has shipped.</h1>
        <p>Hello ${escapeHtml(input.fullName)}. Your pre-order is on its way.</p>
        <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
          ${input.carrier ? `<p style="margin:0 0 8px"><strong>Carrier:</strong> ${escapeHtml(input.carrier)}</p>` : ""}
          ${input.trackingNumber ? `<p style="margin:0"><strong>Tracking number:</strong> ${escapeHtml(input.trackingNumber)}</p>` : ""}
        </div>
        ${input.trackingUrl ? `<p style="margin:30px 0"><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Track shipment</a></p>` : ""}
        ${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">View your order</a></p>` : ""}
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  };
}

export async function sendPreorderShippingEmail(input: PreorderShippingEmailInput) {
  const deliveryKey = `preorder-shipping-${input.preorderId}-${input.trackingNumber ?? "no-tracking"}`;
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "shipping_update",
    recipient: input.email,
    deliveryKey,
    ...renderPreorderShippingEmail(input),
  });
}

export function renderPreorderOwnerActionEmail(
  input: PreorderOwnerActionEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const requestLabel =
    input.requestType === "cancellation"
      ? "cancellation request"
      : "shipping-address change";
  const ownerUrl = `${input.origin}/admin/preorders/${input.preorderId}`;
  const requestedAddress = input.requestedAddress
    ? addressLines(input.requestedAddress)
    : [];

  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Action required: ${requestLabel} — ${orderNumber}`,
    text: [
      `Customer action required for ${orderNumber}.`,
      `Request: ${requestLabel}`,
      `Customer: ${input.fullName} (${input.customerEmail})`,
      ...(input.reason ? [`Reason: ${input.reason}`] : []),
      ...(requestedAddress.length ? ["", "Requested address:", ...requestedAddress] : []),
      ...(input.requestType === "cancellation"
        ? ["", "Policy deadline: submit the full refund within seven working days of cancellation."]
        : []),
      "",
      `Review order: ${ownerUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Customer action required.</h1>
        <p><strong>${escapeHtml(input.fullName)}</strong> submitted a ${escapeHtml(requestLabel)}.</p>
        ${input.reason ? `<p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>` : ""}
        ${requestedAddress.length ? `<p><strong>Requested address</strong><br>${requestedAddress.map(escapeHtml).join("<br>")}</p>` : ""}
        ${input.requestType === "cancellation" ? '<p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Refund required.</strong> Submit the full remaining refund within seven working days of cancellation.</p>' : ""}
        <p style="margin:30px 0"><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Review order</a></p>
      </div>
    `,
  };
}

export async function sendPreorderOwnerActionEmail(
  input: PreorderOwnerActionEmailInput,
) {
  const recipient = await preorderOperationsRecipient();
  if (!recipient) {
    throw new Error("Pre-order operations email is not configured yet.");
  }
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "owner_action_required",
    recipient,
    deliveryKey: input.deliveryKey,
    ...renderPreorderOwnerActionEmail(input),
  });
}

export function renderPreorderAddressChangeResolutionEmail(
  input: PreorderAddressChangeResolutionEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const shipping = addressLines(input.shippingAddress);
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Shipping-address update — ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      input.approved
        ? `The shipping address for ${orderNumber} has been updated.`
        : `We could not apply the requested shipping-address change for ${orderNumber}.`,
      ...(input.resolutionNote ? [`Note: ${input.resolutionNote}`] : []),
      ...(input.approved ? ["", "Shipping address:", ...shipping] : []),
      "",
      `View your order: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${input.approved ? "Your shipping address is updated." : "Your address request needs another step."}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${input.approved ? "We’ve applied the address you requested." : "We could not apply the requested change."}</p>
        ${input.resolutionNote ? `<p><strong>Note:</strong> ${escapeHtml(input.resolutionNote)}</p>` : ""}
        ${input.approved ? `<p><strong>Shipping address</strong><br>${shipping.map(escapeHtml).join("<br>")}</p>` : ""}
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">View your order</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  };
}

export async function sendPreorderAddressChangeResolutionEmail(
  input: PreorderAddressChangeResolutionEmailInput,
) {
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "address_change_resolved",
    recipient: input.email,
    deliveryKey: `preorder-address-change-${input.approved ? "approved" : "declined"}-${input.preorderId}-${input.resolutionVersion}`,
    ...renderPreorderAddressChangeResolutionEmail(input),
  });
}

export function renderPreorderDeliveryUpdateEmail(
  input: PreorderDeliveryUpdateEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Shipping estimate update for your Frame pre-order — ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      `The estimated shipping timing for ${orderNumber} has changed.`,
      `Previous estimate: ${input.previousEstimate}`,
      `Current estimate: ${input.currentEstimate}`,
      `Update: ${input.message}`,
      "",
      "You can accept the updated estimate or cancel for a full refund of the unshipped order.",
      `Review and respond: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">An update to your estimated shipping.</h1>
        <p>Hello ${escapeHtml(input.fullName)}. The estimated shipping timing for your Frame pre-order has changed.</p>
        <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
          <p style="margin:0 0 8px"><strong>Previous:</strong> ${escapeHtml(input.previousEstimate)}</p>
          <p style="margin:0"><strong>Current:</strong> ${escapeHtml(input.currentEstimate)}</p>
        </div>
        <p>${escapeHtml(input.message)}</p>
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Review shipping update</a></p>
        <p style="color:#686a63">You can accept the updated estimate or cancel for a full refund of the unshipped order from your order page.</p>
      </div>
    `,
  };
}

export async function sendPreorderDeliveryUpdateEmail(
  input: PreorderDeliveryUpdateEmailInput,
) {
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "delivery_update",
    recipient: input.email,
    deliveryKey: `preorder-delivery-update-${input.preorderId}-${input.deliveryUpdateVersion}`,
    ...renderPreorderDeliveryUpdateEmail(input),
  });
}

export function renderPreorderRefundUpdateEmail(
  input: PreorderRefundUpdateEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const amount = formatPreorderMoney(input.amountRefunded, input.currency);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const completed = input.status === "completed";
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}${completed ? "Refund completed" : "Refund started"} — ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      completed
        ? `Your ${amount} refund for ${orderNumber} has been completed in Stripe.`
        : `We have started a ${amount} refund for ${orderNumber}.`,
      ...(completed ? [] : ["Your bank may take additional time to display the credit."]),
      "",
      `View your order: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${completed ? "Your refund is complete." : "Your refund has started."}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${completed ? `Stripe has completed a refund of ${escapeHtml(amount)}.` : `We’ve started a refund of ${escapeHtml(amount)}.`}</p>
        ${completed ? "" : '<p style="color:#686a63">Your bank may take additional time to display the credit.</p>'}
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">View your order</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  };
}

export async function sendPreorderRefundUpdateEmail(
  input: PreorderRefundUpdateEmailInput,
) {
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "refund_update",
    recipient: input.email,
    deliveryKey: `preorder-refund-${input.status}-${input.preorderId}-${input.amountRefunded}`,
    ...renderPreorderRefundUpdateEmail(input),
  });
}
