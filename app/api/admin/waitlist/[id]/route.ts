import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  const user = await getChatGPTUser();
  if (!user) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }
  if (!(await isWaitlistAdmin(user.email))) {
    return jsonResponse({ error: "Not authorized." }, 403);
  }

  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return jsonResponse({ error: "Invalid signup." }, 400);
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .delete()
    .eq("id", Number(rawId))
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Waitlist signup deletion failed", error);
    return jsonResponse(
      { error: "The signup could not be deleted. Please try again." },
      503,
    );
  }
  if (!data) {
    return jsonResponse({ error: "Signup not found." }, 404);
  }

  return jsonResponse({ status: "deleted" });
}
