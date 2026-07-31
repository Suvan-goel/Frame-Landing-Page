import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  ensureWaitlistStorage,
  getWaitlistDatabase,
  isWaitlistAdmin,
} from "@/db/waitlist";

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

  await ensureWaitlistStorage();
  const database = await getWaitlistDatabase();
  const signups = await database
    .prepare(
      `SELECT
        email,
        placement,
        utm_source,
        utm_medium,
        utm_campaign,
        created_at
      FROM waitlist_signups
      ORDER BY created_at DESC, id DESC`,
    )
    .all<WaitlistExportRow>();

  const rows = [
    ["email", "placement", "utm_source", "utm_medium", "utm_campaign", "created_at"],
    ...signups.results.map((signup) => [
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
