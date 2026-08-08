import { formatPreorderMoney, formatPreorderNumber } from "./preorder";
import { SITE_URL } from "./site";
import type { PreorderEnvironment } from "./preorder-operations.server";

export type RenderedAutomatedEmail = {
  subject: string;
  text: string;
  html: string;
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
    subject: `${sandbox ? "[Sandbox] " : ""}Your Frame pre-order has shipped | ${orderNumber}`,
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
    subject: `${sandbox ? "[Sandbox] " : ""}Action required: ${requestLabel} | ${orderNumber}`,
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

export function renderPreorderAddressChangeResolutionEmail(
  input: PreorderAddressChangeResolutionEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const shipping = addressLines(input.shippingAddress);
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Shipping-address update | ${orderNumber}`,
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

export function renderPreorderDeliveryUpdateEmail(
  input: PreorderDeliveryUpdateEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}Shipping estimate update for your Frame pre-order | ${orderNumber}`,
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

export function renderPreorderRefundUpdateEmail(
  input: PreorderRefundUpdateEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const amount = formatPreorderMoney(input.amountRefunded, input.currency);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const completed = input.status === "completed";
  return {
    subject: `${sandbox ? "[Sandbox] " : ""}${completed ? "Refund completed" : "Refund started"} | ${orderNumber}`,
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
