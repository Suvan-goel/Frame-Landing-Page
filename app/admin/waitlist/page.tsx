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
  monitoringFrequencyLabels,
  monitoringLabels,
  monitoringOutcomeLabels,
  monitoringReadinessLabels,
  monitoringReasonLabels,
  preorderDeclineReasonLabels,
  qualificationStatusLabels,
  WAITLIST_SIGNUP_SELECT,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";

export const dynamic = "force-dynamic";

type WaitlistView = "new" | "legacy" | "unqualified" | "insights";

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
    requestedTab === "legacy" ||
    requestedTab === "unqualified" ||
    requestedTab === "insights"
      ? requestedTab
      : "new";
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
  const newSurveySignups = qualifiedSignups.filter(
    (entry) => entry.surveyFlow === "new",
  );
  const legacySurveySignups = qualifiedSignups.filter(
    (entry) => entry.surveyFlow === "legacy",
  );
  const unqualifiedSignups = categorizedSignups.filter(
    (entry) => entry.tab === "unqualified",
  );
  const unqualifiedCount = unqualifiedSignups.length;
  const activeSignups =
    activeTab === "insights"
      ? []
      : activeTab === "new"
        ? newSurveySignups
        : activeTab === "legacy"
          ? legacySurveySignups
          : unqualifiedSignups;

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
        <article><span>New survey</span><strong>{newSurveySignups.length}</strong><small>Current flow completed</small></article>
        <article><span>Previous survey</span><strong>{legacySurveySignups.length}</strong><small>Legacy flow completed</small></article>
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
            className={activeTab === "new" ? "is-active" : undefined}
            href={waitlistTabHref("new")}
            aria-current={activeTab === "new" ? "page" : undefined}
          >
            New survey <span>{newSurveySignups.length}</span>
          </a>
          <a
            className={activeTab === "legacy" ? "is-active" : undefined}
            href={waitlistTabHref("legacy")}
            aria-current={activeTab === "legacy" ? "page" : undefined}
          >
            Previous survey <span>{legacySurveySignups.length}</span>
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
            New survey insights <span>{newSurveySignups.length}</span>
          </a>
        </nav>
        <p className="admin-tabs__note">
          {activeTab === "insights"
            ? "Insights use completed responses from the new survey only."
            : activeTab === "unqualified"
              ? "Unqualified leads joined with their email but have not completed and submitted a survey."
              : activeTab === "legacy"
                ? "Previous survey responses retain their original answer format and demographics."
                : "New survey responses use the current behavioural and purchase-objection format."}
        </p>
      </section>

        {activeTab === "insights" ? (
          <QualifiedLeadInsights leads={newSurveySignups} />
        ) : null}

        {activeTab !== "insights" ? (
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">Lead directory</p>
              <h2>
                {activeTab === "new"
                  ? "New survey responses"
                  : activeTab === "legacy"
                    ? "Previous survey responses"
                    : "Unqualified leads"}
              </h2>
            </div>
            <span>{activeSignups.length} shown</span>
          </div>
        ) : null}

        {activeTab !== "insights" && activeSignups.length ? (
          <div className="admin-table-shell">
            <table
              className={`admin-table${activeTab === "new" ? " admin-table--new-survey" : ""}`}
            >
              <thead>
                {activeTab === "unqualified" ? (
                  <tr>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Date and time</th>
                    <th>Delete</th>
                  </tr>
                ) : activeTab === "legacy" ? (
                  <tr>
                    <th>Lead</th>
                    <th>Main reason</th>
                    <th>Monitoring method</th>
                    <th>Written response</th>
                    <th>Research call</th>
                    <th>Profile</th>
                    <th>Source</th>
                    <th>Joined</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                ) : (
                  <tr>
                    <th>Lead</th>
                    <th>30-day frequency</th>
                    <th>Most recent reason or readiness</th>
                    <th>Method</th>
                    <th>Outcome and follow-up</th>
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
                  : activeTab === "legacy"
                    ? activeSignups.map(({ signup, qualification, qualificationStatus, qualitativeInsight }) => (
                      <tr key={signup.id}>
                        <td className="admin-lead">
                          <strong>
                            {[signup.first_name, signup.last_name]
                              .filter(Boolean)
                              .join(" ") || "Previous survey response"}
                          </strong>
                          <a href={`mailto:${signup.email}`}>{signup.email}</a>
                          <small>
                            {[
                              qualificationStatusLabels[qualificationStatus],
                              qualitativeInsight ? "Written response provided" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </td>
                        <td>
                          {qualification.legacyMainReason
                            ? `${mainReasonLabels[qualification.legacyMainReason] ?? qualification.legacyMainReason.replaceAll("_", " ")}${qualification.legacyMainReasonOther ? `: ${qualification.legacyMainReasonOther}` : ""}`
                            : "N/A"}
                        </td>
                        <td>
                          {qualification.monitoringMethod
                            ? monitoringLabels[qualification.monitoringMethod] ??
                              qualification.monitoringMethod.replaceAll("_", " ")
                            : "N/A"}
                        </td>
                        <td>
                          {qualification.qualitativeDetail ? (
                            <small className="admin-motivation">
                              {qualification.qualitativeDetail}
                            </small>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td>
                          {qualification.interviewWillingness
                            ? interviewLabels[qualification.interviewWillingness] ??
                              qualification.interviewWillingness
                            : "N/A"}
                        </td>
                        <td>
                          <strong>
                            {signup.age ? `${signup.age} years` : "Age not provided"}
                          </strong>
                          <small>
                            {signup.gender
                              ? genderLabels[signup.gender] ??
                                signup.gender.replaceAll("_", " ")
                              : "Gender not provided"}
                          </small>
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
                    ))
                  : activeSignups.map(({ signup, qualification, qualificationStatus, qualitativeInsight }) => (
                      <tr key={signup.id}>
                        <td className="admin-lead">
                          <strong>
                            New survey response
                          </strong>
                          <a href={`mailto:${signup.email}`}>{signup.email}</a>
                          <small>
                            {[
                              qualificationStatusLabels[qualificationStatus],
                              qualitativeInsight ? "Written insight provided" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </td>
                        <td>
                          {qualification.monitoringFrequency
                            ? monitoringFrequencyLabels[qualification.monitoringFrequency] ??
                              qualification.monitoringFrequency.replaceAll("_", " ")
                            : "N/A"}
                        </td>
                        <td>
                          {qualification.monitoringReason
                            ? monitoringReasonLabels[qualification.monitoringReason] ??
                              qualification.monitoringReason.replaceAll("_", " ")
                            : qualification.monitoringReadiness
                              ? monitoringReadinessLabels[qualification.monitoringReadiness] ??
                                qualification.monitoringReadiness.replaceAll("_", " ")
                              : "N/A"}
                        </td>
                        <td>
                          {qualification.monitoringMethod
                            ? `${monitoringLabels[qualification.monitoringMethod] ?? qualification.monitoringMethod}${qualification.monitoringMethodOther ? `: ${qualification.monitoringMethodOther}` : ""}`
                            : "N/A"}
                        </td>
                        <td className="admin-survey-answers">
                          <div className="admin-survey-answer">
                            <span className="admin-survey-answer__label">Outcome</span>
                            <strong>
                              {qualification.monitoringOutcome
                                ? monitoringOutcomeLabels[qualification.monitoringOutcome] ??
                                  qualification.monitoringOutcome.replaceAll("_", " ")
                                : "N/A"}
                            </strong>
                          </div>
                          {qualification.qualitativeDetail ? (
                            <div className="admin-survey-answer">
                              <span className="admin-survey-answer__label">
                                Written insight
                              </span>
                              <p>{qualification.qualitativeDetail}</p>
                            </div>
                          ) : null}
                          {qualification.preorderDeclineReason ? (
                            <div className="admin-survey-answer admin-survey-answer--objection">
                              <span className="admin-survey-answer__label">
                                Reservation objection
                              </span>
                              <strong>
                                {preorderDeclineReasonLabels[
                                  qualification.preorderDeclineReason
                                ] ?? qualification.preorderDeclineReason.replaceAll("_", " ")}
                              </strong>
                              {qualification.preorderDeclineDetail
                                ? <p>{qualification.preorderDeclineDetail}</p>
                                : null}
                            </div>
                          ) : null}
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
              {activeTab === "new"
                ? "Completed responses from the new survey will appear here."
                : activeTab === "legacy"
                  ? "Completed responses from the previous survey will appear here."
                  : "Email-only, skipped, or incomplete signups will appear here."}
            </p>
          </div>
        ) : null}

    </AdminDashboardShell>
  );
}
