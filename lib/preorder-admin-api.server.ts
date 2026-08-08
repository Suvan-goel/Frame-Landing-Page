import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { isWaitlistAdmin } from "./supabase-admin.server";

export type PreorderAdminApiAuthorization =
  | { user: ChatGPTUser; error?: never; status?: never }
  | { user?: never; error: string; status: 401 | 403 };

export async function authorizePreorderAdminApi(
  request: Request,
): Promise<PreorderAdminApiAuthorization> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { error: "Request origin is not allowed.", status: 403 };
  }
  const user = await getChatGPTUser();
  if (!user) return { error: "Authentication required.", status: 401 };
  if (!(await isWaitlistAdmin(user.email))) {
    return { error: "Not authorized.", status: 403 };
  }
  return { user };
}

export function isPreorderId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
