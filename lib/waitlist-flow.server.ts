import { headers } from "next/headers";
import { EMAIL_FIRST_WAITLIST_HEADER } from "./waitlist-flow";

export async function isEmailFirstWaitlistEnabled() {
  const requestHeaders = await headers();
  return requestHeaders.get(EMAIL_FIRST_WAITLIST_HEADER) === "1";
}
