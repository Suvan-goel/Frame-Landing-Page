import {
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

const genderLabels: Record<string, string> = {
  woman: "Woman",
  man: "Man",
  non_binary: "Non-binary",
  another_identity: "Another identity",
  prefer_not_to_say: "Prefer not to say",
};

const interviewLabels: Record<string, string> = {
  yes: "Yes",
  possibly: "Possibly",
  no: "No",
};

const ageRanges = [
  { label: "18–24", includes: (age: number) => age >= 18 && age <= 24 },
  { label: "25–34", includes: (age: number) => age >= 25 && age <= 34 },
  { label: "35–44", includes: (age: number) => age >= 35 && age <= 44 },
  { label: "45–54", includes: (age: number) => age >= 45 && age <= 54 },
  { label: "55–64", includes: (age: number) => age >= 55 && age <= 64 },
  { label: "65+", includes: (age: number) => age >= 65 },
] as const;

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

function DistributionChart({
  title,
  description,
  data,
  total,
  wide = false,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  total: number;
  wide?: boolean;
}) {
  const titleId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <article className={`admin-chart${wide ? " admin-chart--wide" : ""}`}>
      <header>
        <div>
          <p>{description}</p>
          <h3 id={titleId}>{title}</h3>
        </div>
        <span>{total} responses</span>
      </header>
      <ol aria-labelledby={titleId}>
        {data.map((datum) => {
          const percentage = total
            ? Math.round((datum.count / total) * 100)
            : 0;
          return (
            <li key={datum.label}>
              <div className="admin-chart__label">
                <span>{datum.label}</span>
                <strong>
                  {datum.count} <small>{percentage}%</small>
                </strong>
              </div>
              <div className="admin-chart__track" aria-hidden="true">
                <span style={{ width: `${percentage}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function QualifiedLeadInsights({ leads }: { leads: QualifiedLead[] }) {
  if (!leads.length) return null;

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
            Compare who the qualified leads are and what they selected before
            sharing their details.
          </p>
        </div>
        <span>{leads.length} qualified leads</span>
      </div>

      <div className="admin-insights__group">
        <div className="admin-insights__group-heading">
          <h3>Demographics</h3>
          <p>Age and self-described gender across the qualified audience.</p>
        </div>
        <div className="admin-insights__grid">
          <DistributionChart
            title="Age range"
            description={averageAge ? `Average age ${averageAge}` : "Age"}
            data={ageData}
            total={ages.length}
          />
          <DistributionChart
            title="Gender"
            description="Self-described"
            data={genderData}
            total={leads.length}
          />
        </div>
      </div>

      <div className="admin-insights__group">
        <div className="admin-insights__group-heading">
          <h3>Multiple-choice responses</h3>
          <p>
            Side-by-side distributions for each question asked before contact
            details.
          </p>
        </div>
        <div className="admin-insights__grid">
          <DistributionChart
            title="Main reason for wanting Frame"
            description="Question 1"
            data={mainReasonData}
            total={leads.length}
            wide
          />
          <DistributionChart
            title="Current monitoring method"
            description="Question 3"
            data={monitoringData}
            total={leads.length}
          />
          <DistributionChart
            title="Willing to join a 20-min call"
            description="Question 4"
            data={interviewData}
            total={leads.length}
          />
        </div>
      </div>
    </section>
  );
}
