import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type WaitlistExportRow = {
  email: string;
  placement: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

function csvCell(value: string | null) {
  let safeValue = value ?? "";
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
    .select("email,placement,utm_source,utm_medium,utm_campaign,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<WaitlistExportRow[]>();

  if (error) {
    console.error("Waitlist CSV query failed", error);
    return Response.json(
      { error: "The waitlist export is temporarily unavailable." },
      { status: 503 },
    );
  }
  const signups = data ?? [];

  const rows = [
    ["email", "placement", "utm_source", "utm_medium", "utm_campaign", "created_at"],
    ...signups.map((signup) => [
      signup.email,
      signup.placement,
      signup.utm_source,
      signup.utm_medium,
      signup.utm_campaign,
      signup.created_at,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="frame-waitlist.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
