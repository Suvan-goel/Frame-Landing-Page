/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "@/app/chatgpt-auth";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { AdminTimeZoneForm } from "@/app/components/admin-time-zone-form";
import { DeleteWaitlistSignupButton } from "@/app/components/delete-waitlist-signup-button";
import { QualifiedLeadInsights } from "./qualified-lead-insights";
import {
  ADMIN_TIME_ZONE_COOKIE,
  resolveAdminTimeZone,
} from "@/lib/admin-time-zone";
import {
  categorizeVisibleSignups,
  genderLabels,
  interviewLabels,
  mainReasonLabels,
  monitoringLabels,
  qualificationStatusLabels,
  WAITLIST_SIGNUP_SELECT,
  type LeadTab,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";

export const dynamic = "force-dynamic";

type WaitlistView = LeadTab | "insights";

function waitlistTabHref(tab: WaitlistView, timeZone: string) {
  return `/admin/waitlist?tab=${tab}&timezone=${encodeURIComponent(timeZone)}`;
}

export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string | string[];
    timezone?: string | string[];
  }>;
}) {
  const user = await requireChatGPTUser("/admin/waitlist");
  if (!(await isWaitlistAdmin(user.email))) {
    notFound();
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .select(WAITLIST_SIGNUP_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500)
    .returns<WaitlistSignup[]>();

  if (error) {
    console.error("Waitlist dashboard query failed", error);
    throw new Error("The waitlist is temporarily unavailable.");
  }
  const resolvedSearchParams = await searchParams;
  const requestedTab = resolvedSearchParams?.tab;
  const activeTab: WaitlistView =
    requestedTab === "unqualified" || requestedTab === "insights"
      ? requestedTab
      : "qualified";
  const requestedTimeZone = resolvedSearchParams?.timezone;
  const cookieStore = await cookies();
  const selectedTimeZone = resolveAdminTimeZone(
    typeof requestedTimeZone === "string" ? requestedTimeZone : undefined,
    cookieStore.get(ADMIN_TIME_ZONE_COOKIE)?.value,
  );
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: selectedTimeZone,
  });
  const signups = data ?? [];
  const categorizedSignups = categorizeVisibleSignups(signups);
  const qualifiedSignups = categorizedSignups.filter(
    (entry) => entry.tab === "qualified",
  );
  const qualifiedCount = qualifiedSignups.length;
  const unqualifiedCount = categorizedSignups.length - qualifiedCount;
  const activeSignups =
    activeTab === "insights"
      ? []
      : categorizedSignups.filter((entry) => entry.tab === activeTab);

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
              {signups.length} {signups.length === 1 ? "signup" : "signups"}
            </p>
          </div>
          <div className="admin-actions">
            <a className="button button--dark" href="/api/admin/waitlist.xlsx">
              Export spreadsheet
            </a>
            <a href="/admin/email">Email</a>
            <a href="/admin/preorders">Pre-orders</a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>
              Sign out
            </a>
          </div>
        </header>

        <AdminTimeZoneForm
          activeTab={activeTab}
          selectedTimeZone={selectedTimeZone}
        />

        <nav className="admin-tabs" aria-label="Waitlist dashboard views">
          <a
            className={activeTab === "qualified" ? "is-active" : undefined}
            href={waitlistTabHref("qualified", selectedTimeZone)}
            aria-current={activeTab === "qualified" ? "page" : undefined}
          >
            Qualified leads <span>{qualifiedCount}</span>
          </a>
          <a
            className={activeTab === "unqualified" ? "is-active" : undefined}
            href={waitlistTabHref("unqualified", selectedTimeZone)}
            aria-current={activeTab === "unqualified" ? "page" : undefined}
          >
            Unqualified leads <span>{unqualifiedCount}</span>
          </a>
          <a
            className={activeTab === "insights" ? "is-active" : undefined}
            href={waitlistTabHref("insights", selectedTimeZone)}
            aria-current={activeTab === "insights" ? "page" : undefined}
          >
            Lead insights <span>{qualifiedCount}</span>
          </a>
        </nav>
        <p className="admin-tabs__note">
          {activeTab === "insights"
            ? "Insights are calculated from qualified leads only."
            : activeTab === "unqualified"
              ? "Unqualified leads joined with their email but have not completed and submitted the full survey."
              : "Qualified leads completed and submitted the full optional survey."}
        </p>

        {activeTab === "insights" ? (
          <QualifiedLeadInsights leads={qualifiedSignups} />
        ) : null}

        {activeTab !== "insights" && activeSignups.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                {activeTab === "unqualified" ? (
                  <tr>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Date and time</th>
                    <th>Delete</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Lead</th>
                    <th>Main reason</th>
                    <th>What Frame should help with</th>
                    <th>Current monitoring</th>
                    <th>Research call</th>
                    <th>Source</th>
                    <th>Joined</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {activeTab === "unqualified"
                  ? activeSignups.map(({ signup }) => (
                      <tr key={signup.id}>
                        <td>
                          <a href={`mailto:${signup.email}`}>{signup.email}</a>
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
                            {dateFormatter.format(new Date(signup.created_at))}
                          </time>
                        </td>
                        <td>
                          <DeleteWaitlistSignupButton
                            signupId={signup.id}
                            leadLabel={signup.email}
                          />
                        </td>
                      </tr>
                    ))
                  : activeSignups.map(({ signup, qualification, qualificationStatus, highIntent }) => (
                      <tr key={signup.id}>
                        <td className="admin-lead">
                          <strong>
                            {[signup.first_name, signup.last_name]
                              .filter(Boolean)
                              .join(" ") || "Qualified signup"}
                          </strong>
                          <a href={`mailto:${signup.email}`}>{signup.email}</a>
                          <small>
                            {[
                              qualificationStatusLabels[qualificationStatus],
                              highIntent ? "High intent" : null,
                              signup.gender
                                ? genderLabels[signup.gender] ??
                                  signup.gender.replaceAll("_", " ")
                                : null,
                              signup.age ? `Age ${signup.age}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </td>
                        <td>
                          {qualification.mainReason
                            ? `${mainReasonLabels[qualification.mainReason] ?? qualification.mainReason}${qualification.mainReasonOther ? ` — ${qualification.mainReasonOther}` : ""}`
                            : "Legacy signup"}
                        </td>
                        <td className="admin-motivation">
                          {qualification.recentSituation ||
                            "No qualification response"}
                        </td>
                        <td>
                          {qualification.monitoringMethod
                            ? `${monitoringLabels[qualification.monitoringMethod] ?? qualification.monitoringMethod}${qualification.monitoringMethodOther ? ` — ${qualification.monitoringMethodOther}` : ""}`
                            : "—"}
                        </td>
                        <td>
                          {qualification.interviewWillingness
                            ? interviewLabels[qualification.interviewWillingness] ??
                              qualification.interviewWillingness.replaceAll("_", " ")
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
                            {dateFormatter.format(new Date(signup.created_at))}
                          </time>
                        </td>
                        <td>
                          <DeleteWaitlistSignupButton
                            signupId={signup.id}
                            leadLabel={
                              [signup.first_name, signup.last_name]
                                .filter(Boolean)
                                .join(" ") || signup.email
                            }
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : activeTab !== "insights" ? (
          <div className="admin-empty">
            <h2>No {activeTab} leads.</h2>
            <p>
              {activeTab === "qualified"
                ? "Completed optional surveys will appear here."
                : "Email-only, skipped, or legacy incomplete signups will appear here."}
            </p>
          </div>
        ) : null}

      </div>
    </main>
  );
}
