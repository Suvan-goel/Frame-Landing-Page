"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ContributorDashboard,
  ContributorProfile,
  ContributorVote,
} from "@/lib/contributor-types";
import { getContributorAccessToken, getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ContributorProfileForm } from "@/app/components/contributor-onboarding";

type HubSection = "home" | "updates" | "questions" | "events" | "votes" | "research" | "profile" | "membership";

const sections: Array<{ id: HubSection; label: string }> = [
  { id: "home", label: "Home" },
  { id: "updates", label: "Updates" },
  { id: "questions", label: "Ask the founder" },
  { id: "events", label: "Events" },
  { id: "votes", label: "Votes" },
  { id: "research", label: "Research" },
  { id: "profile", label: "Profile" },
  { id: "membership", label: "Membership" },
];

function requestedSection(): HubSection | null {
  const requested = new URLSearchParams(window.location.search).get("section");
  return sections.some((section) => section.id === requested)
    ? (requested as HubSection)
    : null;
}

function dateLabel(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function privateFetch(path: string, init?: RequestInit) {
  const preview = new URLSearchParams(window.location.search).get("preview") === "1";
  const accessToken = preview ? null : await getContributorAccessToken();
  if (!preview && !accessToken) throw new Error("AUTH_REQUIRED");
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
}

export function ContributorHub() {
  const [dashboard, setDashboard] = useState<ContributorDashboard | null>(null);
  const [active, setActive] = useState<HubSection>("home");
  const sectionButtons = useRef<Partial<Record<HubSection, HTMLButtonElement | null>>>({});
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [questionStatus, setQuestionStatus] = useState("");
  const [voteStatus, setVoteStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await privateFetch("/api/contributors/me");
        if (response.status === 401) throw new Error("AUTH_REQUIRED");
        if (!response.ok) throw new Error("LOAD_FAILED");
        const result = (await response.json()) as ContributorDashboard;
        if (!cancelled) {
          setDashboard(result);
          setActive(requestedSection() ?? "home");
        }
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof Error && caught.message === "AUTH_REQUIRED") {
          window.location.replace(
            requestedSection() === "profile"
              ? "/contributors/sign-in?next=profile"
              : "/contributors/sign-in",
          );
          return;
        }
        setError("The contributor hub is temporarily unavailable. Please try again.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = useMemo(() => {
    if (!dashboard) return "Contributor";
    return dashboard.membership.preferredName || dashboard.membership.fullName.split(/\s+/)[0];
  }, [dashboard]);

  useEffect(() => {
    sectionButtons.current[active]?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [active]);

  function openSection(section: HubSection) {
    setActive(section);
    const url = new URL(window.location.href);
    if (section === "home") url.searchParams.delete("section");
    else url.searchParams.set("section", section);
    window.history.replaceState(null, "", url);
  }

  function profileSaved(profile: ContributorProfile, completedAt: string) {
    setDashboard((current) => current
      ? {
          ...current,
          profile,
          membership: {
            ...current.membership,
            preferredName: profile.preferredName,
            onboardingCompletedAt: completedAt,
          },
        }
      : current);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionStatus("");
    setBusy(true);
    try {
      const response = await privateFetch("/api/contributors/questions", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not submit your question.");
      setQuestion("");
      setQuestionStatus("Question submitted. The founder will review it for the weekly Q&A.");
    } catch (caught) {
      setQuestionStatus(caught instanceof Error ? caught.message : "Could not submit your question.");
    } finally {
      setBusy(false);
    }
  }

  async function submitVote(event: FormEvent<HTMLFormElement>, vote: ContributorVote) {
    event.preventDefault();
    setVoteStatus("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await privateFetch("/api/contributors/votes", {
        method: "POST",
        body: JSON.stringify({ voteId: vote.id, optionId: data.get("optionId") }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your response.");
      setVoteStatus("Your advisory vote has been saved.");
    } catch (caught) {
      setVoteStatus(caught instanceof Error ? caught.message : "Could not save your response.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (client) await client.auth.signOut();
    window.location.replace("/contributors/sign-in");
  }

  if (!dashboard) {
    return (
      <main className="contributor-hub-loading">
        <p className="eyebrow">Private member area</p>
        <h1>{error ? "We could not load the hub" : "Loading your contributor hub…"}</h1>
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  }

  const member = dashboard.membership;
  return (
    <main className="contributor-hub">
      <aside className="contributor-hub__rail">
        <div>
          <Link className="contributor-hub__brand" href="/" aria-label="Frame home">FRAME</Link>
          <p>Founding Contributor</p>
          <strong>#{String(member.contributorNumber).padStart(4, "0")}</strong>
        </div>
        <nav aria-label="Member hub">
          {sections.map((section) => (
            <button
              key={section.id}
              ref={(button) => {
                sectionButtons.current[section.id] = button;
              }}
              className={active === section.id ? "is-active" : ""}
              type="button"
              onClick={() => openSection(section.id)}
              aria-current={active === section.id ? "page" : undefined}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <button className="contributor-hub__signout" type="button" onClick={signOut}>Sign out</button>
      </aside>

      <div className="contributor-hub__main">
        <header className="contributor-hub__topbar">
          <div>
            <p className="eyebrow">Private member area</p>
            <span>{firstName} · Contributor #{String(member.contributorNumber).padStart(4, "0")}</span>
          </div>
          <span className="contributor-status">Active until {dateLabel(member.accessExpiresAt)}</span>
        </header>

        {active === "home" ? (
          <section className="hub-section">
            <div className="hub-intro">
              <p className="eyebrow">Welcome, {firstName}</p>
              <h1>You are helping build Frame from the beginning.</h1>
              <p>This is where the work stays visible: development notes, direct questions, briefings, advisory votes, and research invitations.</p>
            </div>
            {!member.onboardingCompletedAt ? (
              <div className="hub-notice">
                <div><strong>Complete your contributor profile</strong><p>Tell us what you want to learn and how you would like to contribute.</p></div>
                <button className="button button--primary" type="button" onClick={() => openSection("profile")}>Complete profile</button>
              </div>
            ) : null}
            <div className="hub-summary-grid">
              <button type="button" onClick={() => openSection("updates")}><span>Latest update</span><strong>{dashboard.updates[0]?.title ?? "Coming soon"}</strong></button>
              <button type="button" onClick={() => openSection("events")}><span>Next briefing</span><strong>{dashboard.events[0] ? dateLabel(dashboard.events[0].startsAt, true) : "To be announced"}</strong></button>
              <button type="button" onClick={() => openSection("votes")}><span>Open advisory votes</span><strong>{dashboard.votes.length}</strong></button>
            </div>
            <div className="hub-roadmap">
              <div className="hub-section-heading"><p className="eyebrow">Development roadmap</p><h2>Where Frame is now</h2></div>
              <ol>
                {dashboard.roadmap.map((step) => (
                  <li key={step.label} className={`is-${step.status}`}>
                    <span>{step.label}</span><strong>{step.title}</strong><small>{step.status === "current" ? "Current focus" : step.status === "completed" ? "Completed" : "Proposed, not guaranteed"}</small>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {active === "updates" ? (
          <section className="hub-section">
            <div className="hub-section-heading"><p className="eyebrow">Development journal</p><h1>Updates</h1><p>What was attempted, what was learned, and where uncertainty remains.</p></div>
            <div className="hub-stack">
              {dashboard.updates.map((update) => (
                <article className="hub-card hub-update" key={update.id}>
                  <div><span>{update.category}</span><time dateTime={update.publishedAt}>{dateLabel(update.publishedAt)}</time></div>
                  <h2>{update.title}</h2><p className="hub-card__lead">{update.summary}</p><p>{update.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {active === "questions" ? (
          <section className="hub-section hub-two-column">
            <div>
              <div className="hub-section-heading"><p className="eyebrow">Weekly founder Q&amp;A</p><h1>Ask the founder</h1><p>Ask about development, decisions, or the contributor programme. Do not include personal medical information.</p></div>
              <form className="hub-card hub-question-form" onSubmit={submitQuestion}>
                <label htmlFor="member-question">Your question</label>
                <textarea id="member-question" minLength={20} maxLength={1500} rows={7} value={question} onChange={(event) => setQuestion(event.target.value)} required />
                <div><small>{question.length}/1,500</small><button className="button button--primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit question"}</button></div>
                {questionStatus ? <p role="status" className="contributor-form-message">{questionStatus}</p> : null}
              </form>
            </div>
            <div className="hub-published-questions">
              <h2>Published answers</h2>
              {dashboard.questions.map((item) => (
                <article className="hub-card" key={item.id}><span>{item.askedBy}</span><h3>{item.question}</h3>{item.answer ? <p>{item.answer}</p> : <p>Awaiting an answer.</p>}</article>
              ))}
            </div>
          </section>
        ) : null}

        {active === "events" ? (
          <section className="hub-section">
            <div className="hub-section-heading"><p className="eyebrow">Private briefings</p><h1>Events and recordings</h1><p>Briefings are for active contributors and may be recorded for the hub.</p></div>
            <div className="hub-card-grid">
              {dashboard.events.map((event) => (
                <article className="hub-card" key={event.id}><time dateTime={event.startsAt}>{dateLabel(event.startsAt, true)}</time><h2>{event.title}</h2><p>{event.description}</p>{event.eventUrl ? <a className="text-link" href={event.eventUrl} rel="noreferrer">Join briefing</a> : <span className="hub-muted">Joining details coming soon</span>}{event.recordingUrl ? <a className="text-link" href={event.recordingUrl} rel="noreferrer">Watch recording</a> : null}</article>
              ))}
            </div>
          </section>
        ) : null}

        {active === "votes" ? (
          <section className="hub-section">
            <div className="hub-section-heading"><p className="eyebrow">Contributor input</p><h1>Advisory votes</h1><p>Votes inform the team but do not bind product, engineering, clinical, regulatory, or company decisions.</p></div>
            <div className="hub-stack">
              {dashboard.votes.map((vote) => (
                <form className="hub-card hub-vote" key={vote.id} onSubmit={(event) => submitVote(event, vote)}>
                  <span>Closes {dateLabel(vote.closesAt)}</span><h2>{vote.title}</h2><p>{vote.description}</p>
                  <fieldset><legend className="sr-only">Choose one response</legend>{vote.options.map((option) => <label key={option.id}><input type="radio" name="optionId" value={option.id} defaultChecked={option.id === vote.selectedOptionId} required /><span>{option.label}</span></label>)}</fieldset>
                  <button className="button button--primary" type="submit" disabled={busy}>Save advisory vote</button>
                </form>
              ))}
            </div>
            {voteStatus ? <p role="status" className="contributor-form-message">{voteStatus}</p> : null}
          </section>
        ) : null}

        {active === "research" ? (
          <section className="hub-section">
            <div className="hub-section-heading"><p className="eyebrow">Optional participation</p><h1>Research opportunities</h1><p>Participation is always optional. Opportunities will explain eligibility, consent, and any data requested before you apply.</p></div>
            <div className="hub-card-grid">
              {dashboard.research.map((item) => (
                <article className="hub-card" key={item.id}><span>Research opportunity</span><h2>{item.title}</h2><p>{item.description}</p><p><strong>Eligibility:</strong> {item.eligibility}</p>{item.applyUrl ? <a className="button button--primary" href={item.applyUrl} rel="noreferrer">View opportunity</a> : <span className="hub-muted">Applications opening soon</span>}</article>
              ))}
            </div>
          </section>
        ) : null}

        {active === "profile" ? (
          <section className="hub-section hub-profile">
            <div className="hub-section-heading">
              <p className="eyebrow">Your contributor profile</p>
              <h1>{member.onboardingCompletedAt ? "Profile and preferences" : "Complete your profile"}</h1>
              <p>
                Tell us how to address you and where you would most like to contribute.
                You can return here and change these details at any time.
              </p>
            </div>
            <ContributorProfileForm
              profile={dashboard.profile}
              fullName={member.fullName}
              onSaved={profileSaved}
            />
          </section>
        ) : null}

        {active === "membership" ? (
          <section className="hub-section">
            <div className="hub-section-heading"><p className="eyebrow">Your access</p><h1>Membership</h1><p>Your one-time membership does not renew automatically.</p></div>
            <div className="hub-membership-card">
              <div><span>Founding Contributor</span><strong>#{String(member.contributorNumber).padStart(4, "0")}</strong></div>
              <dl>
                <div><dt>Status</dt><dd>{member.membershipStatus}</dd></div>
                <div><dt>Paid</dt><dd>{money(member.amountPaidCents, member.currency)} on {dateLabel(member.paidAt)}</dd></div>
                <div><dt>Access period</dt><dd>{dateLabel(member.accessStartsAt)} – {dateLabel(member.accessExpiresAt)}</dd></div>
                <div><dt>Future product discount</dt><dd>{member.futureDiscountEligible ? "Eligible, if a product becomes available" : "Not eligible"}</dd></div>
                <div><dt>Terms accepted</dt><dd>{member.termsVersion}</dd></div>
              </dl>
              <nav><Link href="/contributors/terms">Membership Terms</Link><Link href="/contributors/refunds">Refund Policy</Link><Link href="/contributors/product-status">Product Status</Link><Link href="/contact">Contact support</Link></nav>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
