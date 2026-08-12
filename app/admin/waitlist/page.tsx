import { notFound } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { AdminTimeZoneForm } from "@/app/components/admin-time-zone-form";
import {
  getSupabaseAdmin,
  isWaitlistAdmin,
} from "@/lib/supabase-admin.server";
import { DeleteWaitlistSignupButton } from "@/app/components/delete-waitlist-signup-button";
import { QualifiedLeadInsights } from "./qualified-lead-insights";
import { getPersistedAdminTimeZone } from "@/lib/admin-settings.server";
import { retrySupabaseReadOnJwtIssuedAtFuture } from "@/lib/supabase-retry";
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

function waitlistTabHref(tab: WaitlistView) {
  return `/admin/waitlist?tab=${tab}`;
}

function WaitlistUnavailable({ userEmail }: { userEmail: string }) {
  return (
    <AdminDashboardShell
      activeSection="waitlist"
      description="The lead workspace is temporarily unavailable."
      title="Waitlist"
      userEmail={userEmail}
    >
      <div className="admin-empty" role="alert">
        <h2>The waitlist could not be loaded.</h2>
        <p>
          The data connection was briefly unavailable. No data was changed. {" "}
          <a href="/admin/waitlist">Try again</a>.
        </p>
      </div>
    </AdminDashboardShell>
  );
}

export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
}) {
  const user = await requireChatGPTUser("/admin/waitlist");
  if (!(await isWaitlistAdmin(user.email))) {
    notFound();
  }

  const supabase = await getSupabaseAdmin();
  const [{ data, error }, selectedTimeZone] = await Promise.all([
    retrySupabaseReadOnJwtIssuedAtFuture(
      () =>
        supabase
          .from("waitlist_signups")
          .select(WAITLIST_SIGNUP_SELECT)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(500)
          .returns<WaitlistSignup[]>(),
      {
        onRetry: (_error, retryNumber) => {
          console.warn(
            `Waitlist dashboard query hit transient Supabase JWT clock skew; retrying (${retryNumber}).`,
          );
        },
      },
    ),
    getPersistedAdminTimeZone(),
  ]);

  if (error) {
    console.error("Waitlist dashboard query failed", error);
    return <WaitlistUnavailable userEmail={user.email} />;
  }
  const resolvedSearchParams = await searchParams;
  const requestedTab = resolvedSearchParams?.tab;
  const activeTab: WaitlistView =
    requestedTab === "unqualified" || requestedTab === "insights"
      ? requestedTab
      : "qualified";
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
  const highIntentCount = qualifiedSignups.filter(
    (entry) => entry.highIntent,
  ).length;
  const activeSignups =
    activeTab === "insights"
      ? []
      : categorizedSignups.filter((entry) => entry.tab === activeTab);

  return (
    <AdminDashboardShell
      activeSection="waitlist"
      actions={
        <a className="button button--dark" href="/api/admin/waitlist.xlsx">
          Export spreadsheet
        </a>
      }
      description="Review lead quality, understand demand, and keep the research pipeline organised."
      title="Waitlist"
      userEmail={user.email}
    >
      <section className="admin-metrics" aria-label="Waitlist overview">
        <article><span>Total signups</span><strong>{signups.length}</strong><small>All visible leads</small></article>
        <article><span>Qualified</span><strong>{qualifiedCount}</strong><small>Survey completed</small></article>
        <article><span>High intent</span><strong>{highIntentCount}</strong><small>Priority conversations</small></article>
        <article><span>Unqualified</span><strong>{unqualifiedCount}</strong><small>Email-only or incomplete</small></article>
      </section>

      <section className="admin-control-panel" aria-label="Waitlist controls">
        <div className="admin-control-panel__heading">
          <div>
            <p className="eyebrow">View controls</p>
            <h2>Organise your lead pipeline</h2>
          </div>
          <p>Switch lead groups or localise timestamps without losing your place.</p>
        </div>

        <AdminTimeZoneForm
          activeTab={activeTab}
          selectedTimeZone={selectedTimeZone}
        />

        <nav className="admin-tabs" aria-label="Waitlist dashboard views">
          <a
            className={activeTab === "qualified" ? "is-active" : undefined}
            href={waitlistTabHref("qualified")}
            aria-current={activeTab === "qualified" ? "page" : undefined}
          >
            Qualified leads <span>{qualifiedCount}</span>
          </a>
          <a
            className={activeTab === "unqualified" ? "is-active" : undefined}
            href={waitlistTabHref("unqualified")}
            aria-current={activeTab === "unqualified" ? "page" : undefined}
          >
            Unqualified leads <span>{unqualifiedCount}</span>
          </a>
          <a
            className={activeTab === "insights" ? "is-active" : undefined}
            href={waitlistTabHref("insights")}
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
      </section>

        {activeTab === "insights" ? (
          <QualifiedLeadInsights leads={qualifiedSignups} />
        ) : null}

        {activeTab !== "insights" ? (
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">Lead directory</p>
              <h2>{activeTab === "qualified" ? "Qualified leads" : "Unqualified leads"}</h2>
            </div>
            <span>{activeSignups.length} shown</span>
          </div>
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
                            ? `${mainReasonLabels[qualification.mainReason] ?? qualification.mainReason}${qualification.mainReasonOther ? `: ${qualification.mainReasonOther}` : ""}`
                            : "Legacy signup"}
                        </td>
                        <td className="admin-motivation">
                          {qualification.recentSituation ||
                            "No qualification response"}
                        </td>
                        <td>
                          {qualification.monitoringMethod
                            ? `${monitoringLabels[qualification.monitoringMethod] ?? qualification.monitoringMethod}${qualification.monitoringMethodOther ? `: ${qualification.monitoringMethodOther}` : ""}`
                            : "N/A"}
                        </td>
                        <td>
                          {qualification.interviewWillingness
                            ? interviewLabels[qualification.interviewWillingness] ??
                              qualification.interviewWillingness.replaceAll("_", " ")
                            : "N/A"}
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

    </AdminDashboardShell>
  );
}
