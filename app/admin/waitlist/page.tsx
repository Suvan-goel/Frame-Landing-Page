/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import { BrandWordmark } from "@/app/components/brand-wordmark";

export const dynamic = "force-dynamic";

type WaitlistSignup = {
  id: number;
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

const mainReasonLabels: Record<string, string> = {
  monitor_high_or_borderline: "Monitor high or borderline blood pressure",
  understand_sleep: "Understand blood pressure while sleeping",
  understand_daily_factors: "Understand food, alcohol, stress and exercise",
  understand_unexplained_changes: "Understand unexplained changes",
  track_response_and_recovery: "Track response and recovery",
  something_else: "Something else",
};

const monitoringLabels: Record<string, string> = {
  upper_arm_regularly: "Upper-arm cuff regularly",
  upper_arm_occasionally: "Upper-arm cuff occasionally",
  wearable_or_cuffless: "Wearable or cuffless device",
  medical_appointments_only: "Medical appointments only",
  not_currently_monitoring: "Does not currently monitor",
};

type QualificationResponse = {
  mainReason: string | null;
  recentSituation: string | null;
  monitoringMethod: string | null;
  interviewWillingness: string | null;
};

type LeadTab = "qualified" | "unqualified";

function parseQualificationResponse(
  motivation: string | null,
): QualificationResponse {
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

function isQualifiedSignup(
  signup: WaitlistSignup,
  qualification: QualificationResponse,
) {
  return Boolean(
    signup.first_name?.trim() &&
      signup.last_name?.trim() &&
      signup.gender &&
      Number.isInteger(signup.age) &&
      qualification.mainReason &&
      qualification.recentSituation &&
      qualification.monitoringMethod &&
      qualification.interviewWillingness,
  );
}

function isVisibleSignup(signup: WaitlistSignup) {
  return signup.first_name?.trim().toLocaleLowerCase() !== "suvan";
}

export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const user = await requireChatGPTUser("/admin/waitlist");
  if (!(await isWaitlistAdmin(user.email))) {
    notFound();
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .select(
      "id,first_name,last_name,email,gender,age,motivation,placement,utm_source,utm_medium,utm_campaign,created_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500)
    .returns<WaitlistSignup[]>();

  if (error) {
    console.error("Waitlist dashboard query failed", error);
    throw new Error("The waitlist is temporarily unavailable.");
  }
  const requestedTab = (await searchParams)?.tab;
  const activeTab: LeadTab =
    requestedTab === "unqualified" ? "unqualified" : "qualified";
  const visibleSignups = (data ?? []).filter(isVisibleSignup);
  const categorizedSignups = visibleSignups.map((signup) => {
    const qualification = parseQualificationResponse(signup.motivation);
    return {
      signup,
      qualification,
      tab: isQualifiedSignup(signup, qualification)
        ? ("qualified" as const)
        : ("unqualified" as const),
    };
  });
  const qualifiedCount = categorizedSignups.filter(
    (entry) => entry.tab === "qualified",
  ).length;
  const unqualifiedCount = categorizedSignups.length - qualifiedCount;
  const activeSignups = categorizedSignups.filter(
    (entry) => entry.tab === activeTab,
  );

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home">
              <BrandWordmark />
            </a>
            <p className="eyebrow">Owner view</p>
            <h1>Waitlist</h1>
            <p>
              {visibleSignups.length} visible{" "}
              {visibleSignups.length === 1 ? "signup" : "signups"}
            </p>
          </div>
          <div className="admin-actions">
            <a className="button button--dark" href="/api/admin/waitlist.csv">
              Export CSV
            </a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>
              Sign out
            </a>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="Waitlist lead status">
          <a
            className={activeTab === "qualified" ? "is-active" : undefined}
            href="/admin/waitlist?tab=qualified"
            aria-current={activeTab === "qualified" ? "page" : undefined}
          >
            Qualified leads <span>{qualifiedCount}</span>
          </a>
          <a
            className={activeTab === "unqualified" ? "is-active" : undefined}
            href="/admin/waitlist?tab=unqualified"
            aria-current={activeTab === "unqualified" ? "page" : undefined}
          >
            Unqualified leads <span>{unqualifiedCount}</span>
          </a>
        </nav>
        <p className="admin-tabs__note">
          Qualified leads completed every early-access qualification and
          demographic field.
        </p>

        {activeSignups.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Main reason</th>
                  <th>Recent situation</th>
                  <th>Current monitoring</th>
                  <th>20-min call</th>
                  <th>Source</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {activeSignups.map(({ signup, qualification }) => (
                  <tr key={signup.id}>
                    <td className="admin-lead">
                      <strong>
                        {[signup.first_name, signup.last_name]
                          .filter(Boolean)
                          .join(" ") || "Unqualified signup"}
                      </strong>
                      <a href={`mailto:${signup.email}`}>{signup.email}</a>
                      <small>
                        {[
                          signup.gender?.replaceAll("_", " "),
                          signup.age ? `Age ${signup.age}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Demographics not provided"}
                      </small>
                    </td>
                    <td>
                      {qualification.mainReason
                        ? mainReasonLabels[qualification.mainReason] ??
                          qualification.mainReason
                        : "Legacy signup"}
                    </td>
                    <td className="admin-motivation">
                      {qualification.recentSituation ||
                        "No qualification response"}
                    </td>
                    <td>
                      {qualification.monitoringMethod
                        ? monitoringLabels[qualification.monitoringMethod] ??
                          qualification.monitoringMethod
                        : "—"}
                    </td>
                    <td>
                      {qualification.interviewWillingness
                        ? qualification.interviewWillingness[0].toUpperCase() +
                          qualification.interviewWillingness.slice(1)
                        : "—"}
                    </td>
                    <td className="admin-source">
                      <span>{signup.placement.replaceAll("_", " ")}</span>
                      <small>
                        {[signup.utm_source, signup.utm_medium, signup.utm_campaign]
                          .filter(Boolean)
                          .join(" / ") || "Direct"}
                      </small>
                    </td>
                    <td>
                      <time dateTime={signup.created_at}>
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        }).format(new Date(signup.created_at))}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">
            <h2>No {activeTab} leads.</h2>
            <p>
              {activeTab === "qualified"
                ? "Completed early-access applications will appear here."
                : "Legacy or incomplete signups will appear here."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
