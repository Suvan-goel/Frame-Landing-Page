import { headers } from "next/headers";

export async function isPreorderSalesPageEnabled() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-frame-preorder-sales-request") === "1";
}

export async function isPreorderAdminPageEnabled() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-frame-preorder-admin-request") === "1";
}
