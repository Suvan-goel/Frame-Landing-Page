"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatName } from "@/lib/name-format";
import { trackMetaLead } from "./meta-pixel";

const WAITLIST_JOINED_STORAGE_KEY = "frame-waitlist-joined";
const MIN_SITUATION_LENGTH = 20;
const MAX_SITUATION_LENGTH = 750;
const MIN_AGE = 18;
const MAX_AGE = 120;

const MAIN_REASON_OPTIONS = [
  [
    "monitor_high_or_borderline",
    "Monitor high or borderline blood pressure without repeated cuff readings",
  ],
  ["understand_sleep", "Understand my blood pressure while sleeping"],
  [
    "understand_daily_factors",
    "See how food, alcohol, stress and exercise affect me",
  ],
  [
    "understand_unexplained_changes",
    "Understand unexplained changes in my blood pressure",
  ],
  [
    "track_response_and_recovery",
    "Track cardiovascular response and recovery",
  ],
  ["something_else", "Something else"],
] as const;

const MONITORING_OPTIONS = [
  ["upper_arm_regularly", "Upper-arm cuff regularly"],
  ["upper_arm_occasionally", "Upper-arm cuff occasionally"],
  ["wearable_or_cuffless", "Wearable or cuffless device"],
  ["medical_appointments_only", "Only during medical appointments"],
  ["not_currently_monitoring", "I do not currently monitor it"],
] as const;

const INTERVIEW_OPTIONS = [
  ["yes", "Yes"],
  ["possibly", "Possibly"],
  ["no", "No"],
] as const;

const GENDER_OPTIONS = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["non_binary", "Non-binary"],
  ["another_identity", "Another identity"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;

type WaitlistStatus = "idle" | "submitting" | "joined" | "updated" | "error";
type FieldName =
  | "mainReason"
  | "recentSituation"
  | "monitoringMethod"
  | "interviewWillingness"
  | "firstName"
  | "lastName"
  | "age"
  | "gender"
  | "email";
type FieldErrors = Partial<Record<FieldName, string>>;

function ChoiceList({
  idPrefix,
  name,
  options,
  value,
  error,
  onChange,
}: {
  idPrefix: string;
  name: FieldName;
  options: readonly (readonly [string, string])[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset
      className="interest-flow__choices"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${idPrefix}-${name}-error` : undefined}
    >
      <legend className="sr-only">Choose one option</legend>
      {options.map(([optionValue, label]) => (
        <label key={optionValue} className="interest-flow__choice">
          <input
            type="radio"
            name={name}
            value={optionValue}
            checked={value === optionValue}
            onChange={() => onChange(optionValue)}
          />
          <span aria-hidden="true" />
          <strong>{label}</strong>
        </label>
      ))}
      {error ? (
        <p className="form-error" id={`${idPrefix}-${name}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function InterestFlow() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [mainReason, setMainReason] = useState("");
  const [recentSituation, setRecentSituation] = useState("");
  const [monitoringMethod, setMonitoringMethod] = useState("");
  const [interviewWillingness, setInterviewWillingness] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, status]);

  function clearError(field: FieldName) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmissionError("");
    if (status === "error") setStatus("idle");
  }

  function validateStep(currentStep: number) {
    const nextErrors: FieldErrors = {};
    if (currentStep === 0 && !MAIN_REASON_OPTIONS.some(([value]) => value === mainReason)) {
      nextErrors.mainReason = "Choose the one main reason that matters most to you.";
    }
    if (currentStep === 1) {
      const length = recentSituation.trim().length;
      if (length < MIN_SITUATION_LENGTH) {
        nextErrors.recentSituation = `Write at least ${MIN_SITUATION_LENGTH} characters about what you want Frame to help you understand or do.`;
      } else if (length > MAX_SITUATION_LENGTH) {
        nextErrors.recentSituation = `Keep your response to ${MAX_SITUATION_LENGTH} characters or fewer.`;
      }
    }
    if (
      currentStep === 2 &&
      !MONITORING_OPTIONS.some(([value]) => value === monitoringMethod)
    ) {
      nextErrors.monitoringMethod = "Choose how you currently monitor your blood pressure.";
    }
    if (
      currentStep === 3 &&
      !INTERVIEW_OPTIONS.some(([value]) => value === interviewWillingness)
    ) {
      nextErrors.interviewWillingness = "Choose one response.";
    }
    if (currentStep === 4) {
      const normalizedFirstName = firstName.trim().replace(/\s+/g, " ");
      const normalizedLastName = lastName.trim().replace(/\s+/g, " ");
      const normalizedAge = age.trim();
      const parsedAge = Number(normalizedAge);
      const normalizedEmail = email.trim();

      if (!normalizedFirstName || normalizedFirstName.length > 60) {
        nextErrors.firstName = "Enter your first name.";
      }
      if (!normalizedLastName || normalizedLastName.length > 60) {
        nextErrors.lastName = "Enter your last name.";
      }
      if (
        !/^\d{1,3}$/.test(normalizedAge) ||
        !Number.isInteger(parsedAge) ||
        parsedAge < MIN_AGE ||
        parsedAge > MAX_AGE
      ) {
        nextErrors.age = `Enter an age between ${MIN_AGE} and ${MAX_AGE}.`;
      }
      if (!GENDER_OPTIONS.some(([value]) => value === gender)) {
        nextErrors.gender = "Select a gender option.";
      }
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        normalizedEmail.length > 254
      ) {
        nextErrors.email = "Enter a valid email address.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleContinue() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, 4));
  }

  function resetFlow() {
    setStep(0);
    setMainReason("");
    setRecentSituation("");
    setMonitoringMethod("");
    setInterviewWillingness("");
    setFirstName("");
    setLastName("");
    setAge("");
    setGender("");
    setEmail("");
    setErrors({});
    setSubmissionError("");
    setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(4)) return;

    setSubmissionError("");
    setStatus("submitting");
    const query = new URLSearchParams(window.location.search);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainReason,
          recentSituation: recentSituation.trim(),
          monitoringMethod,
          interviewWillingness,
          firstName: formatName(firstName),
          lastName: formatName(lastName),
          age: Number(age.trim()),
          gender,
          email: email.trim(),
          website: formData.get("website"),
          placement: "interest_page",
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
        }),
      });
      const result = (await response.json()) as {
        status?: "joined" | "updated";
        error?: string;
      };

      if (!response.ok || !result.status) {
        throw new Error(
          result.error ?? "We couldn’t save your application. Please try again.",
        );
      }

      setStatus(result.status);
      trackMetaLead();
      try {
        window.localStorage.setItem(WAITLIST_JOINED_STORAGE_KEY, "true");
      } catch {
        // A successful signup should not be affected by unavailable storage.
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your application. Please try again.",
      );
      setStatus("error");
    }
  }

  const titles = [
    "What is the main reason you want Frame?",
    "What would you want Frame to help you understand or do that you can’t easily today?",
    "How do you currently monitor your blood pressure?",
    "Would you be willing to speak with us for 20 minutes?",
    "A little about you.",
  ];

  return (
    <main className="interest-flow" aria-labelledby="interest-flow-title">
      <div className="interest-flow__shell">
        <header className="interest-flow__header">
          <Link className="interest-flow__wordmark" href="/" aria-label="Frame home">
            Frame
          </Link>
          <Link
            className="interest-flow__close"
            href="/"
            aria-label="Back to home"
          >
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </header>

        {status === "joined" || status === "updated" ? (
          <div className="interest-flow__success" role="status" aria-live="polite">
            <p className="eyebrow">Thank you</p>
            <h2 id="interest-flow-title" ref={headingRef} tabIndex={-1}>
              Your interest has been registered!
            </h2>
            <p>
              Thanks, {formatName(firstName)}. We genuinely read all responses and
              your input is invaluable for Frame&apos;s development.
            </p>
            <div className="interest-flow__success-actions">
              <Link className="button button--dark" href="/">
                <span aria-hidden="true">←</span> Back to home
              </Link>
              <button className="interest-flow__text-button" type="button" onClick={resetFlow}>
                Submit another response
              </button>
            </div>
          </div>
        ) : (
          <form className="interest-flow__form" onSubmit={handleSubmit} noValidate>
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="interest-website">Website</label>
              <input id="interest-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="interest-flow__progress" aria-label={`Step ${step + 1} of 5`}>
              <span>0{step + 1}</span>
              <div><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
              <span>05</span>
            </div>

            <div className="interest-flow__content">
              <p className="eyebrow">Frame early access</p>
              <h2 id="interest-flow-title" ref={headingRef} tabIndex={-1}>
                {titles[step]}
              </h2>

              {step === 0 ? (
                <ChoiceList
                  idPrefix="interest"
                  name="mainReason"
                  options={MAIN_REASON_OPTIONS}
                  value={mainReason}
                  error={errors.mainReason}
                  onChange={(value) => {
                    setMainReason(value);
                    clearError("mainReason");
                  }}
                />
              ) : null}

              {step === 1 ? (
                <div className="interest-flow__text-response form-field">
                  <label htmlFor="interest-recent-situation" className="sr-only">
                    What would you want Frame to help you understand or do that you can&apos;t easily today?
                  </label>
                  <textarea
                    id="interest-recent-situation"
                    name="recentSituation"
                    value={recentSituation}
                    onChange={(event) => {
                      setRecentSituation(event.target.value);
                      clearError("recentSituation");
                    }}
                    placeholder="For example: Help me understand why my blood pressure changes throughout the day…"
                    minLength={MIN_SITUATION_LENGTH}
                    maxLength={MAX_SITUATION_LENGTH}
                    aria-invalid={Boolean(errors.recentSituation)}
                    aria-describedby="interest-recent-situation-hint"
                    autoFocus
                  />
                  <div className="field-hint" id="interest-recent-situation-hint">
                    <span>Share a specific situation if you can · minimum {MIN_SITUATION_LENGTH} characters</span>
                    <span>{recentSituation.trim().length}/{MAX_SITUATION_LENGTH}</span>
                  </div>
                  {errors.recentSituation ? <p className="form-error" role="alert">{errors.recentSituation}</p> : null}
                  <p className="interest-flow__privacy-note">Please don’t include private medical information.</p>
                </div>
              ) : null}

              {step === 2 ? (
                <ChoiceList
                  idPrefix="interest"
                  name="monitoringMethod"
                  options={MONITORING_OPTIONS}
                  value={monitoringMethod}
                  error={errors.monitoringMethod}
                  onChange={(value) => {
                    setMonitoringMethod(value);
                    clearError("monitoringMethod");
                  }}
                />
              ) : null}

              {step === 3 ? (
                <ChoiceList
                  idPrefix="interest"
                  name="interviewWillingness"
                  options={INTERVIEW_OPTIONS}
                  value={interviewWillingness}
                  error={errors.interviewWillingness}
                  onChange={(value) => {
                    setInterviewWillingness(value);
                    clearError("interviewWillingness");
                  }}
                />
              ) : null}

              {step === 4 ? (
                <div className="interest-flow__details">
                  <p>We’ll use these details only to contact you about Frame.</p>
                  <div className="form-name-fields">
                    <div className="form-field">
                      <label htmlFor="interest-first-name">First name</label>
                      <input id="interest-first-name" name="firstName" type="text" autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearError("firstName"); }} maxLength={60} aria-invalid={Boolean(errors.firstName)} />
                      {errors.firstName ? <p className="form-error" role="alert">{errors.firstName}</p> : null}
                    </div>
                    <div className="form-field">
                      <label htmlFor="interest-last-name">Last name</label>
                      <input id="interest-last-name" name="lastName" type="text" autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); clearError("lastName"); }} maxLength={60} aria-invalid={Boolean(errors.lastName)} />
                      {errors.lastName ? <p className="form-error" role="alert">{errors.lastName}</p> : null}
                    </div>
                  </div>
                  <div className="form-demographic-fields">
                    <div className="form-field">
                      <label htmlFor="interest-age">Age</label>
                      <input id="interest-age" name="age" type="number" inputMode="numeric" value={age} onChange={(event) => { setAge(event.target.value); clearError("age"); }} min={MIN_AGE} max={MAX_AGE} step={1} aria-invalid={Boolean(errors.age)} />
                      {errors.age ? <p className="form-error" role="alert">{errors.age}</p> : null}
                    </div>
                    <div className="form-field">
                      <label htmlFor="interest-gender">Gender</label>
                      <select id="interest-gender" name="gender" value={gender} onChange={(event) => { setGender(event.target.value); clearError("gender"); }} aria-invalid={Boolean(errors.gender)}>
                        <option value="" disabled>Select an option</option>
                        {GENDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      {errors.gender ? <p className="form-error" role="alert">{errors.gender}</p> : null}
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="interest-email">Email address</label>
                    <input id="interest-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearError("email"); }} maxLength={254} aria-invalid={Boolean(errors.email)} />
                    {errors.email ? <p className="form-error" role="alert">{errors.email}</p> : null}
                  </div>
                  <p className="form-note">No spam. Unsubscribe any time. <a href="/privacy">Privacy</a></p>
                </div>
              ) : null}
            </div>

            {submissionError ? <p className="form-error form-error--submission" role="alert">{submissionError}</p> : null}

            <footer className="interest-flow__actions">
              {step > 0 ? (
                <button className="interest-flow__back" type="button" onClick={() => { setErrors({}); setSubmissionError(""); setStep((current) => current - 1); }} disabled={status === "submitting"}>
                  Back
                </button>
              ) : <span />}
              {step < 4 ? (
                <button className="button button--dark" type="button" onClick={handleContinue}>
                  Continue
                </button>
              ) : (
                <button className="button button--dark" type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Submitting…" : "Register my interest"}
                </button>
              )}
            </footer>
          </form>
        )}
      </div>
    </main>
  );
}
