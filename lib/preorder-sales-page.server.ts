import { headers } from "next/headers";

export async function isPreorderSalesPageEnabled() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-frame-preorder-sales-request") === "1";
}
