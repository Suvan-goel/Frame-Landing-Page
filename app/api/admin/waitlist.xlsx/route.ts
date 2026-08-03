import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import {
  categorizeVisibleSignups,
  toWaitlistExportRow,
  waitlistExportHeaders,
  type LeadTab,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";
import { createXlsxWorkbook } from "@/lib/xlsx.server";

export const dynamic = "force-dynamic";

const sheetNames: Record<LeadTab, string> = {
  qualified: "Qualified leads",
  unqualified: "Unqualified leads",
};

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
    .select(
      "id,first_name,last_name,email,gender,age,motivation,placement,utm_source,utm_medium,utm_campaign,created_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<WaitlistSignup[]>();

  if (error) {
    console.error("Waitlist workbook query failed", error);
    return Response.json(
      { error: "The waitlist export is temporarily unavailable." },
      { status: 503 },
    );
  }

  const categorizedSignups = categorizeVisibleSignups(data ?? []);
  const workbook = createXlsxWorkbook(
    (["qualified", "unqualified"] as const).map((tab) => ({
      name: sheetNames[tab],
      rows: [
        [...waitlistExportHeaders],
        ...categorizedSignups
          .filter((entry) => entry.tab === tab)
          .map(({ signup, qualification }) =>
            toWaitlistExportRow(signup, qualification),
          ),
      ],
    })),
  );

  return new Response(Uint8Array.from(workbook), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        'attachment; filename="frame-waitlist.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
