import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type WaitlistExportRow = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  gender: string | null;
  age: number | null;
  motivation: string | null;
  placement: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

function parseQualificationResponse(motivation: string | null) {
  const fallback = {
    mainReason: null,
    recentSituation: motivation,
    monitoringMethod: null,
    interviewWillingness: null,
  };
  if (!motivation?.startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(motivation) as Record<string, unknown>;
    if (parsed.version !== 2) return fallback;
    return {
      mainReason:
        typeof parsed.mainReason === "string" ? parsed.mainReason : null,
      recentSituation:
        typeof parsed.recentSituation === "string"
          ? parsed.recentSituation
          : null,
      monitoringMethod:
        typeof parsed.monitoringMethod === "string"
          ? parsed.monitoringMethod
          : null,
      interviewWillingness:
        typeof parsed.interviewWillingness === "string"
          ? parsed.interviewWillingness
          : null,
    };
  } catch {
    return fallback;
  }
}

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
    .select(
      "first_name,last_name,email,gender,age,motivation,placement,utm_source,utm_medium,utm_campaign,created_at",
    )
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
    [
      "first_name",
      "last_name",
      "email",
      "gender",
      "age",
      "main_reason",
      "recent_situation",
      "monitoring_method",
      "interview_willingness",
      "motivation",
      "placement",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "created_at",
    ],
    ...signups.map((signup) => {
      const qualification = parseQualificationResponse(signup.motivation);
      return [
        signup.first_name,
        signup.last_name,
        signup.email,
        signup.gender,
        signup.age,
        qualification.mainReason,
        qualification.recentSituation,
        qualification.monitoringMethod,
        qualification.interviewWillingness,
        signup.motivation,
        signup.placement,
        signup.utm_source,
        signup.utm_medium,
        signup.utm_campaign,
        signup.created_at,
      ];
    }),
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
