import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import {
  categorizeVisibleSignups,
  toWaitlistExportRow,
  WAITLIST_SIGNUP_SELECT,
  waitlistExportHeaders,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null) {
  let safeValue = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!(await isWaitlistAdmin(user.email))) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .select(WAITLIST_SIGNUP_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<WaitlistSignup[]>();

  if (error) {
    console.error("Waitlist CSV query failed", error);
    return Response.json(
      { error: "The subscriber export is temporarily unavailable." },
      { status: 503 },
    );
  }
  const rows = [
    [...waitlistExportHeaders],
    ...categorizeVisibleSignups(data ?? []).map(({ signup, qualification }) =>
      toWaitlistExportRow(signup, qualification),
    ),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="frame-subscribers.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
