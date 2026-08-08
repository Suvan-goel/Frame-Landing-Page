import {
  confirmPreorderContactEmailChange,
  sendConfirmedPreorderEmailChangeNotices,
} from "@/lib/preorder-customer-management.server";
import { isPreorderSalesRequestEnabled } from "@/lib/runtime-env.server";

export const dynamic = "force-dynamic";

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      Location: location,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: Request) {
  if (!(await isPreorderSalesRequestEnabled(request))) {
    return new Response("Not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  try {
    const result = await confirmPreorderContactEmailChange(token);
    if (result.status !== "updated") {
      return redirect("/preorder/manage?email_change=invalid");
    }
    await sendConfirmedPreorderEmailChangeNotices({
      origin: url.origin,
      result,
    });
    return redirect(`${result.managePath}&notice=email-updated`);
  } catch (error) {
    console.error("Pre-order email change confirmation failed", error);
    return redirect("/preorder/manage?email_change=unavailable");
  }
}
