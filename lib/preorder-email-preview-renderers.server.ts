import { formatPreorderMoney, formatPreorderNumber } from "./preorder";
import { SITE_URL } from "./site";
import type { PreorderEnvironment } from "./preorder-operations.server";
import {
  renderFrameTransactionalEmail,
  renderTransactionalBodyCopy,
  renderTransactionalNotice,
  renderTransactionalSummaryPanel,
} from "./transactional-email-design";
import { SUPPORT_EMAIL } from "./company";

const PREORDER_SUPPORT_LINE = `Support: ${SUPPORT_EMAIL}`;

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
  const subject = `${sandbox ? "[Sandbox] " : ""}Your Frame pre-order has shipped | ${orderNumber}`;
  const shipmentRows = [
    ...(input.carrier ? [{ label: "Carrier", value: input.carrier }] : []),
    ...(input.trackingNumber
      ? [{ label: "Tracking number", value: input.trackingNumber }]
      : []),
  ];

  return {
    subject,
    text: [
      `Hello ${input.fullName},`,
      "",
      `Your Frame pre-order ${orderNumber} has shipped.`,
      ...trackingText,
      ...(manageUrl ? ["", `View your order: ${manageUrl}`] : []),
      "",
      PREORDER_SUPPORT_LINE,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: `Frame pre-order ${orderNumber} is on its way.`,
      headerLabel: "Order shipped",
      headerMarker: "check",
      eyebrow: `${sandbox ? "Sandbox · " : ""}Pre-order ${orderNumber}`,
      heading: "Your Frame has shipped.",
      intro: `Hello ${input.fullName}. Your pre-order is on its way.`,
      bodyHtml: renderTransactionalSummaryPanel({
        eyebrow: "Shipment details",
        title: "Frame wearable",
        rows: shipmentRows.length
          ? shipmentRows
          : [{ label: "Status", value: "Preparing carrier details" }],
      }),
      cta: input.trackingUrl
        ? { label: "Track shipment", href: input.trackingUrl }
        : manageUrl
          ? { label: "View your order", href: manageUrl }
          : null,
      secondaryLink:
        input.trackingUrl && manageUrl
          ? { label: "View your order", href: manageUrl }
          : null,
      footerNote: `This is a transactional email about pre-order ${orderNumber}.`,
      footerLinks: [
        { label: "Pre-order terms", href: `${input.origin}/preorder/terms` },
        { label: "Cancellation & refunds", href: `${input.origin}/preorder/refunds` },
        { label: "Product status", href: `${input.origin}/preorder/product-status` },
      ],
    }),
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
  const subject = `${sandbox ? "[Sandbox] " : ""}Action required: ${requestLabel} | ${orderNumber}`;
  const details = renderTransactionalSummaryPanel({
    eyebrow: "Customer request",
    title: requestLabel,
    rows: [
      { label: "Customer", value: input.fullName },
      { label: "Email", value: input.customerEmail },
      ...(input.reason ? [{ label: "Reason", value: input.reason }] : []),
      ...(requestedAddress.length
        ? [{ label: "Requested address", value: requestedAddress.join("\n") }]
        : []),
    ],
  });

  return {
    subject,
    text: [
      `Customer action required for ${orderNumber}.`,
      `Request: ${requestLabel}`,
      `Customer: ${input.fullName} (${input.customerEmail})`,
      ...(input.reason ? [`Reason: ${input.reason}`] : []),
      ...(requestedAddress.length ? ["", "Requested address:", ...requestedAddress] : []),
      ...(input.requestType === "cancellation"
        ? ["", "Policy deadline: submit the full refund within seven business days of the cancellation request."]
        : []),
      "",
      `Review order: ${ownerUrl}`,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: `${input.fullName} submitted a ${requestLabel} for ${orderNumber}.`,
      headerLabel: "Action required",
      headerMarker: "alert",
      eyebrow: `${sandbox ? "Sandbox · " : ""}Pre-order ${orderNumber}`,
      heading: "Customer action required.",
      intro: `${input.fullName} submitted a ${requestLabel}.`,
      bodyHtml:
        details +
        (input.requestType === "cancellation"
          ? renderTransactionalNotice({
              title: "Refund required.",
              body: "Submit the full remaining refund within seven business days of the cancellation request.",
              tone: "warning",
            })
          : ""),
      cta: { label: "Review order", href: ownerUrl },
      footerNote: `Internal operational email for pre-order ${orderNumber}.`,
      footerLinks: [{ label: "Open order record", href: ownerUrl }],
    }),
  };
}

export function renderPreorderAddressChangeResolutionEmail(
  input: PreorderAddressChangeResolutionEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const shipping = addressLines(input.shippingAddress);
  const subject = `${sandbox ? "[Sandbox] " : ""}Shipping-address update | ${orderNumber}`;
  return {
    subject,
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
      PREORDER_SUPPORT_LINE,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: input.approved
        ? `The shipping address for ${orderNumber} has been updated.`
        : `Your address request for ${orderNumber} needs another step.`,
      headerLabel: input.approved ? "Address updated" : "Follow-up needed",
      headerMarker: input.approved ? "check" : "alert",
      eyebrow: `${sandbox ? "Sandbox · " : ""}Pre-order ${orderNumber}`,
      heading: input.approved
        ? "Your shipping address is updated."
        : "Your address request needs another step.",
      intro: `Hello ${input.fullName}. ${input.approved ? "We’ve applied the address you requested." : "We could not apply the requested change."}`,
      bodyHtml:
        (input.approved
          ? renderTransactionalSummaryPanel({
              eyebrow: "Shipping address",
              title: "Address on file",
              rows: [{ label: "Deliver to", value: shipping.join("\n") }],
            })
          : "") +
        (input.resolutionNote
          ? renderTransactionalNotice({
              title: input.approved ? "Note." : "What we need.",
              body: input.resolutionNote,
              tone: input.approved ? "success" : "warning",
            })
          : ""),
      cta: { label: "View your order", href: manageUrl },
      footerNote: `This is a transactional email about pre-order ${orderNumber}.`,
      footerLinks: [
        { label: "Pre-order terms", href: `${input.origin}/preorder/terms` },
        { label: "Cancellation & refunds", href: `${input.origin}/preorder/refunds` },
      ],
    }),
  };
}

export function renderPreorderDeliveryUpdateEmail(
  input: PreorderDeliveryUpdateEmailInput,
): RenderedAutomatedEmail {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${SITE_URL}${input.managePath}`;
  const subject = `${sandbox ? "[Sandbox] " : ""}Shipping estimate update for your Frame pre-order | ${orderNumber}`;
  return {
    subject,
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
      PREORDER_SUPPORT_LINE,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: `Estimated shipping for ${orderNumber} changed from ${input.previousEstimate} to ${input.currentEstimate}.`,
      headerLabel: "Shipping update",
      headerMarker: "arrow",
      eyebrow: `${sandbox ? "Sandbox · " : ""}Pre-order ${orderNumber}`,
      heading: "An update to your estimated shipping.",
      intro: `Hello ${input.fullName}. The estimated shipping timing for your Frame pre-order has changed.`,
      bodyHtml:
        renderTransactionalSummaryPanel({
          eyebrow: "Revised timeline",
          title: "Estimated shipping",
          rows: [
            { label: "Previous estimate", value: input.previousEstimate },
            { label: "Current estimate", value: input.currentEstimate, emphasis: true },
          ],
        }) +
        renderTransactionalBodyCopy(input.message) +
        renderTransactionalNotice({
          title: "Your choice remains open.",
          body: "You can accept the updated estimate or cancel for a full refund of the unshipped order from your order page.",
        }),
      cta: { label: "Review shipping update", href: manageUrl },
      footerNote: `This is a transactional email about pre-order ${orderNumber}.`,
      footerLinks: [
        { label: "Pre-order terms", href: `${input.origin}/preorder/terms` },
        { label: "Cancellation & refunds", href: `${input.origin}/preorder/refunds` },
        { label: "Product status", href: `${input.origin}/preorder/product-status` },
      ],
    }),
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
  const subject = `${sandbox ? "[Sandbox] " : ""}${completed ? "Refund completed" : "Refund started"} | ${orderNumber}`;
  return {
    subject,
    text: [
      `Hello ${input.fullName},`,
      "",
      completed
        ? `Your ${amount} refund for ${orderNumber} has been completed in Stripe.`
        : `We have started a ${amount} refund for ${orderNumber}.`,
      ...(completed ? [] : ["Your bank may take additional time to display the credit."]),
      "",
      `View your order: ${manageUrl}`,
      PREORDER_SUPPORT_LINE,
    ].join("\n"),
    html: renderFrameTransactionalEmail({
      origin: input.origin,
      subject,
      preheader: `${completed ? "Refund completed" : "Refund started"} for pre-order ${orderNumber}: ${amount}.`,
      headerLabel: completed ? "Refund complete" : "Refund processing",
      headerMarker: completed ? "check" : "arrow",
      eyebrow: `${sandbox ? "Sandbox · " : ""}Pre-order ${orderNumber}`,
      heading: completed ? "Your refund is complete." : "Your refund has started.",
      intro: `Hello ${input.fullName}. ${completed ? `Stripe has completed a refund of ${amount}.` : `We’ve started a refund of ${amount}.`}`,
      bodyHtml:
        renderTransactionalSummaryPanel({
          eyebrow: "Refund summary",
          title: amount,
          rows: [
            { label: "Order", value: orderNumber },
            {
              label: "Status",
              value: completed ? "Completed" : "Processing",
              emphasis: true,
            },
          ],
        }) +
        (completed
          ? renderTransactionalNotice({
              title: "Refund completed.",
              body: "The refund has been returned through the original payment method.",
              tone: "success",
            })
          : renderTransactionalNotice({
              title: "What happens next.",
              body: "Your bank may take additional time to display the credit.",
            })),
      cta: { label: "View your order", href: manageUrl },
      footerNote: `This is a transactional email about pre-order ${orderNumber}.`,
      footerLinks: [
        { label: "Cancellation & refunds", href: `${input.origin}/preorder/refunds` },
        { label: "Contact", href: `${input.origin}/contact` },
      ],
    }),
  };
}
