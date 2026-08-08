export const AUTOMATED_EMAIL_PREVIEW_IDS = [
  "preorder-confirmation",
  "preorder-shipped",
  "owner-action-required",
  "address-change-approved",
  "address-change-declined",
  "delivery-estimate-updated",
  "refund-started",
  "refund-completed",
  "contributor-welcome",
] as const;

export type AutomatedEmailPreviewId =
  (typeof AUTOMATED_EMAIL_PREVIEW_IDS)[number];

export type AutomatedEmailCategory =
  | "preorders"
  | "customer-actions"
  | "contributors";

export type AutomatedEmailPreview = {
  id: AutomatedEmailPreviewId;
  name: string;
  category: AutomatedEmailCategory;
  categoryLabel: string;
  description: string;
  trigger: string;
  audience: string;
  recipientExample: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  links: string[];
  configured: boolean;
  configurationLabel: string;
};

export function isAutomatedEmailPreviewId(
  value: unknown,
): value is AutomatedEmailPreviewId {
  return (
    typeof value === "string" &&
    AUTOMATED_EMAIL_PREVIEW_IDS.includes(value as AutomatedEmailPreviewId)
  );
}
