import {
  monitoringFrequencyLabels,
  monitoringLabels,
  monitoringOutcomeLabels,
  monitoringReadinessLabels,
  monitoringReasonLabels,
  preorderDeclineReasonLabels,
  type QualificationResponse,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";

type QualifiedLead = {
  signup: Pick<WaitlistSignup, "age" | "gender">;
  qualification: QualificationResponse;
};

type ChartDatum = { label: string; count: number };
type ChartTone = "burgundy" | "sage" | "terracotta";

function humanize(value: string) {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function responseBreakdown(
  leads: QualifiedLead[],
  response: (lead: QualifiedLead) => string | null,
  labels: Record<string, string>,
) {
  const counts = new Map(Object.keys(labels).map((value) => [value, 0]));
  leads.forEach((lead) => {
    const value = response(lead);
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts, ([value, count]) => ({
    label: labels[value] ?? humanize(value),
    count,
  }));
}

function percentage(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function leadingDatum(data: ChartDatum[]) {
  return data.reduce<ChartDatum | null>(
    (leading, datum) => (!leading || datum.count > leading.count ? datum : leading),
    null,
  );
}

function DistributionChart({
  title,
  eyebrow,
  data,
  total,
  tone,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  data: ChartDatum[];
  total: number;
  tone: ChartTone;
  wide?: boolean;
}) {
  const titleId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <article
      className={`admin-chart admin-chart--${tone}${wide ? " admin-chart--wide" : ""}`}
    >
      <header className="admin-chart__header">
        <div>
          <p>{eyebrow}</p>
          <h3 id={titleId}>{title}</h3>
        </div>
        <span>{total} responses</span>
      </header>
      <ol className="admin-chart__rows" aria-labelledby={titleId}>
        {data.map((datum) => {
          const share = percentage(datum.count, total);
          return (
            <li key={datum.label}>
              <div className="admin-chart__label">
                <span>{datum.label}</span>
                <strong>
                  {datum.count} <small>{share}%</small>
                </strong>
              </div>
              <div className="admin-chart__track" aria-hidden="true">
                <span style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function InsightMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function QualifiedLeadInsights({ leads }: { leads: QualifiedLead[] }) {
  if (!leads.length) {
    return (
      <section className="admin-empty admin-insights-empty">
        <h2>No new survey insights yet.</h2>
        <p>Charts will appear after the first completed new survey.</p>
      </section>
    );
  }

  const frequencyData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringFrequency,
    monitoringFrequencyLabels,
  );
  const reasonData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringReason,
    monitoringReasonLabels,
  );
  const readinessData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringReadiness,
    monitoringReadinessLabels,
  );
  const monitoringData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringMethod,
    monitoringLabels,
  );
  const outcomeData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringOutcome,
    monitoringOutcomeLabels,
  );
  const preorderDeclineData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.preorderDeclineReason,
    preorderDeclineReasonLabels,
  );
  const recentMonitorCount = leads.filter(({ qualification }) =>
    [
      "sixteen_or_more_days",
      "eight_to_fifteen_days",
      "three_to_seven_days",
      "one_or_two_days",
    ].includes(qualification.monitoringFrequency ?? ""),
  ).length;
  const unresolvedCount = leads.filter(({ qualification }) =>
    [
      "worked_with_difficulty",
      "easy_but_unanswered",
      "difficult_and_unanswered",
    ].includes(qualification.monitoringOutcome ?? ""),
  ).length;
  const writtenInsightCount = leads.filter(({ qualification }) =>
    Boolean(qualification.qualitativeDetail?.trim()),
  ).length;
  const preorderDeclineCount = leads.filter(({ qualification }) =>
    Boolean(qualification.preorderDeclineReason),
  ).length;
  const topFrequency = leadingDatum(frequencyData);

  return (
    <section className="admin-insights" aria-labelledby="new-survey-insights-title">
      <div className="admin-insights__heading">
        <div>
          <p className="eyebrow">Behavioural evidence</p>
          <h2 id="new-survey-insights-title">New survey insights</h2>
          <p>
            Recent monitoring behaviour, existing alternatives and unresolved
            problems from the current survey flow only.
          </p>
        </div>
        <span>{leads.length} new survey responses</span>
      </div>

      <div className="admin-insight-metrics" aria-label="Survey insight highlights">
        <InsightMetric
          label="Monitored in 30 days"
          value={`${percentage(recentMonitorCount, leads.length)}%`}
          detail={`${recentMonitorCount} respondents measured at least once`}
        />
        <InsightMetric
          label="Unresolved problem"
          value={`${percentage(unresolvedCount, leads.length)}%`}
          detail={`${unresolvedCount} reported difficulty or unanswered questions`}
        />
        <InsightMetric
          label="Written insight"
          value={`${percentage(writtenInsightCount, leads.length)}%`}
          detail={`${writtenInsightCount} voluntarily added qualitative detail`}
        />
        <InsightMetric
          label="Not ready to pre-order"
          value={`${percentage(preorderDeclineCount, leads.length)}%`}
          detail={`${preorderDeclineCount} supplied their main objection`}
        />
      </div>

      <div className="admin-insights__group">
        <div className="admin-insights__group-heading">
          <div>
            <p className="eyebrow">What they actually do</p>
            <h3>Behavioural survey responses</h3>
          </div>
          <p>Top frequency: {topFrequency?.label ?? "No response data"}.</p>
        </div>
        <div className="admin-insights__grid">
          <DistributionChart
            title="Days monitored in the past 30 days"
            eyebrow="Question 1"
            data={frequencyData}
            total={leads.length}
            tone="burgundy"
            wide
          />
          <DistributionChart
            title="Why respondents were not ready to pre-order"
            eyebrow="Post-survey objection"
            data={preorderDeclineData}
            total={preorderDeclineCount}
            tone="burgundy"
            wide
          />
          <DistributionChart
            title="Reason for the most recent reading"
            eyebrow="Question 2 · measured before"
            data={reasonData}
            total={reasonData.reduce((total, datum) => total + datum.count, 0)}
            tone="sage"
          />
          <DistributionChart
            title="Readiness among people who never monitored"
            eyebrow="Question 2 · never measured"
            data={readinessData}
            total={readinessData.reduce((total, datum) => total + datum.count, 0)}
            tone="terracotta"
          />
          <DistributionChart
            title="Most recently used method"
            eyebrow="Question 3"
            data={monitoringData}
            total={monitoringData.reduce((total, datum) => total + datum.count, 0)}
            tone="sage"
          />
          <DistributionChart
            title="Whether the method solved the job"
            eyebrow="Question 4"
            data={outcomeData}
            total={outcomeData.reduce((total, datum) => total + datum.count, 0)}
            tone="terracotta"
            wide
          />
        </div>
      </div>
    </section>
  );
}
