import { getChatGPTUser } from "@/app/chatgpt-auth";
import { setPersistedAdminTimeZone } from "@/lib/admin-settings.server";
import { isAdminTimeZone } from "@/lib/admin-time-zone";
import { hasAllowedFormRequestOrigin } from "@/lib/request-origin.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type WaitlistView = "new" | "legacy" | "unqualified" | "insights";

function isWaitlistView(value: FormDataEntryValue | null): value is WaitlistView {
  return (
    value === "new" ||
    value === "legacy" ||
    value === "unqualified" ||
    value === "insights"
  );
}

function response(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!hasAllowedFormRequestOrigin(request)) {
    return response("Request origin is not allowed.", 403);
  }

  const user = await getChatGPTUser();
  if (!user) {
    return response("Authentication required.", 401);
  }
  if (!(await isWaitlistAdmin(user.email))) {
    return response("Not authorized.", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return response("Invalid form submission.", 400);
  }

  const timeZone = formData.get("timezone");
  if (!isAdminTimeZone(timeZone)) {
    return response("Select a valid time zone.", 400);
  }

  try {
    await setPersistedAdminTimeZone(timeZone, user.email);
  } catch (error) {
    console.error("Admin time zone save request failed", error);
    return response("The time zone could not be saved. Please try again.", 503);
  }

  const activeTab = formData.get("tab");
  const redirectUrl = new URL("/admin/waitlist", request.url);
  if (isWaitlistView(activeTab) && activeTab !== "new") {
    redirectUrl.searchParams.set("tab", activeTab);
  }

  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      Location: redirectUrl.toString(),
    },
  });
}
