import { headers } from "next/headers";
import { isFoundingContributorSalesEnabled } from "./runtime-env.server";

export async function isFoundingContributorSalesPageEnabled() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  return isFoundingContributorSalesEnabled(host);
}
