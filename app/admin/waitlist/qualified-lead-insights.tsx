import type { CSSProperties } from "react";
import {
  genderLabels,
  interviewLabels,
  mainReasonLabels,
  monitoringLabels,
  type QualificationResponse,
  type WaitlistSignup,
} from "@/lib/waitlist-leads";

type QualifiedLead = {
  signup: Pick<WaitlistSignup, "age" | "gender">;
  qualification: QualificationResponse;
};

type ChartDatum = {
  label: string;
  count: number;
};

type ChartTone = "burgundy" | "sage" | "terracotta";

const ageRanges = [
  { label: "18–24", includes: (age: number) => age >= 18 && age <= 24 },
  { label: "25–34", includes: (age: number) => age >= 25 && age <= 34 },
  { label: "35–44", includes: (age: number) => age >= 35 && age <= 44 },
  { label: "45–54", includes: (age: number) => age >= 45 && age <= 54 },
  { label: "55–64", includes: (age: number) => age >= 55 && age <= 64 },
  { label: "65+", includes: (age: number) => age >= 65 },
] as const;

const donutColours = ["#8d3e46", "#6e806f", "#c38262", "#a9935c", "#80768b"];

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

function ChartHeader({
  eyebrow,
  title,
  total,
  titleId,
}: {
  eyebrow: string;
  title: string;
  total: number;
  titleId: string;
}) {
  return (
    <header className="admin-chart__header">
      <div>
        <p>{eyebrow}</p>
        <h3 id={titleId}>{title}</h3>
      </div>
      <span>{total} responses</span>
    </header>
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
      <ChartHeader eyebrow={eyebrow} title={title} total={total} titleId={titleId} />
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

function AgeChart({
  data,
  total,
  averageAge,
}: {
  data: ChartDatum[];
  total: number;
  averageAge: number | null;
}) {
  const titleId = "chart-age-range";
  const highestCount = Math.max(...data.map(({ count }) => count), 1);

  return (
    <article className="admin-chart admin-chart--age">
      <ChartHeader
        eyebrow={averageAge ? `Average age ${averageAge}` : "Age"}
        title="Age distribution"
        total={total}
        titleId={titleId}
      />
      <ol className="admin-age-chart" aria-labelledby={titleId}>
        {data.map((datum) => {
          const height = Math.round((datum.count / highestCount) * 100);
          return (
            <li key={datum.label}>
              <strong>{datum.count}</strong>
              <div aria-hidden="true">
                <span style={{ height: `${height}%` }} />
              </div>
              <small>{datum.label}</small>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function DonutChart({ data, total }: { data: ChartDatum[]; total: number }) {
  const titleId = "chart-gender";
  let offset = 0;
  const segments = data.map((datum, index) => {
    const start = offset;
    offset += total ? (datum.count / total) * 100 : 0;
    return `${donutColours[index % donutColours.length]} ${start}% ${offset}%`;
  });
  const background = total
    ? `conic-gradient(${segments.join(", ")})`
    : "rgba(32, 33, 30, 0.08)";

  return (
    <article className="admin-chart admin-chart--gender">
      <ChartHeader
        eyebrow="Self-described"
        title="Gender distribution"
        total={total}
        titleId={titleId}
      />
      <div className="admin-donut-layout">
        <div
          className="admin-donut"
          style={{ background } as CSSProperties}
          role="img"
          aria-label={`Gender distribution across ${total} qualified leads`}
        >
          <span>
            <strong>{total}</strong>
            <small>leads</small>
          </span>
        </div>
        <ul aria-labelledby={titleId}>
          {data.map((datum, index) => (
            <li key={datum.label}>
              <i
                style={{ backgroundColor: donutColours[index % donutColours.length] }}
                aria-hidden="true"
              />
              <span>{datum.label}</span>
              <strong>{percentage(datum.count, total)}%</strong>
            </li>
          ))}
        </ul>
      </div>
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
        <h2>No qualified lead insights yet.</h2>
        <p>Charts will appear after the first complete early-access application.</p>
      </section>
    );
  }

  const ages = leads
    .map(({ signup }) => signup.age)
    .filter((age): age is number => typeof age === "number");
  const ageData = ageRanges.map((range) => ({
    label: range.label,
    count: ages.filter(range.includes).length,
  }));
  const averageAge = ages.length
    ? Math.round(ages.reduce((total, age) => total + age, 0) / ages.length)
    : null;
  const genderData = responseBreakdown(
    leads,
    ({ signup }) => signup.gender,
    genderLabels,
  );
  const mainReasonData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.mainReason,
    mainReasonLabels,
  );
  const monitoringData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.monitoringMethod,
    monitoringLabels,
  );
  const interviewData = responseBreakdown(
    leads,
    ({ qualification }) => qualification.interviewWillingness,
    interviewLabels,
  );
  const largestAgeGroup = leadingDatum(ageData);
  const topReason = leadingDatum(mainReasonData);
  const openToCall = interviewData
    .filter(({ label }) => label === "Yes" || label === "Possibly")
    .reduce((total, { count }) => total + count, 0);

  return (
    <section
      className="admin-insights"
      aria-labelledby="qualified-insights-title"
    >
      <div className="admin-insights__heading">
        <div>
          <p className="eyebrow">Audience overview</p>
          <h2 id="qualified-insights-title">Qualified lead insights</h2>
          <p>
            A clear view of who the qualified leads are and how they answered
            the optional survey.
          </p>
        </div>
        <span>{leads.length} qualified leads</span>
      </div>

      <div className="admin-insight-metrics" aria-label="Lead insight highlights">
        <InsightMetric
          label="Average age"
          value={averageAge ? String(averageAge) : "N/A"}
          detail={largestAgeGroup ? `Largest group: ${largestAgeGroup.label}` : "No age data"}
        />
        <InsightMetric
          label="Top reason"
          value={topReason ? `${percentage(topReason.count, leads.length)}%` : "N/A"}
          detail={topReason?.label ?? "No response data"}
        />
        <InsightMetric
          label="Open to a call"
          value={`${percentage(openToCall, leads.length)}%`}
          detail={`${openToCall} answered yes or possibly`}
        />
      </div>

      <div className="admin-insights__group">
        <div className="admin-insights__group-heading">
          <div>
            <p className="eyebrow">Who they are</p>
            <h3>Demographics</h3>
          </div>
          <p>Age and self-described gender across the qualified audience.</p>
        </div>
        <div className="admin-insights__grid admin-insights__grid--demographics">
          <AgeChart data={ageData} total={ages.length} averageAge={averageAge} />
          <DonutChart data={genderData} total={leads.length} />
        </div>
      </div>

      <div className="admin-insights__group">
        <div className="admin-insights__group-heading">
          <div>
            <p className="eyebrow">What they told us</p>
            <h3>Multiple-choice responses</h3>
          </div>
          <p>Response distributions aligned with the current survey.</p>
        </div>
        <div className="admin-insights__grid">
          <DistributionChart
            title="What is the main reason you want Frame?"
            eyebrow="Question 2"
            data={mainReasonData}
            total={leads.length}
            tone="burgundy"
            wide
          />
          <DistributionChart
            title="How do you currently monitor your blood pressure?"
            eyebrow="Question 4"
            data={monitoringData}
            total={leads.length}
            tone="sage"
          />
          <DistributionChart
            title="Would you be willing to speak with us for 20 minutes?"
            eyebrow="Question 5"
            data={interviewData}
            total={leads.length}
            tone="terracotta"
          />
        </div>
      </div>
    </section>
  );
}
