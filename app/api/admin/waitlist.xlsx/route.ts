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
import { createXlsxWorkbook } from "@/lib/xlsx.server";

export const dynamic = "force-dynamic";

const sheetNames = {
  new: "New survey leads",
  legacy: "Previous survey leads",
  unqualified: "Unqualified leads",
} as const;

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
    console.error("Waitlist workbook query failed", error);
    return Response.json(
      { error: "The subscriber export is temporarily unavailable." },
      { status: 503 },
    );
  }

  const categorizedSignups = categorizeVisibleSignups(data ?? []);
  const workbook = createXlsxWorkbook(
    (["new", "legacy", "unqualified"] as const).map((section) => ({
      name: sheetNames[section],
      rows: [
        [...waitlistExportHeaders],
        ...categorizedSignups
          .filter((entry) =>
            section === "unqualified"
              ? entry.tab === "unqualified"
              : entry.tab === "qualified" && entry.surveyFlow === section,
          )
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
        'attachment; filename="frame-subscribers.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
