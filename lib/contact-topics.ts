import { SUPPORT_EMAIL } from "@/lib/company";

export const CONTACT_TOPICS = [
  {
    value: "general",
    label: "General question",
    recipient: SUPPORT_EMAIL,
  },
  {
    value: "preorder",
    label: "Pre-order support",
    recipient: "preorders@framewearable.com",
  },
  {
    value: "research",
    label: "Research or engineering",
    recipient: "research@framewearable.com",
  },
  {
    value: "partnerships",
    label: "Partnership or press",
    recipient: "partnerships@framewearable.com",
  },
  {
    value: "privacy",
    label: "Privacy or data request",
    recipient: "privacy@framewearable.com",
  },
  {
    value: "other",
    label: "Something else",
    recipient: SUPPORT_EMAIL,
  },
] as const;

export function getContactTopic(value: string) {
  return CONTACT_TOPICS.find((topic) => topic.value === value);
}
