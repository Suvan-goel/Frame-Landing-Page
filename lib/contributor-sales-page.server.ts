import { headers } from "next/headers";

export async function isFoundingContributorSalesPageEnabled() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-frame-contributor-local-request") === "1";
}
