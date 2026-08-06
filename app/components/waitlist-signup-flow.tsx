"use client";

import Link from "next/link";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MONITORING_METHOD_OPTIONS,
  PRIMARY_INTEREST_OPTIONS,
  RESEARCH_CALL_OPTIONS,
} from "@/lib/waitlist-options";
import {
  trackMetaLead,
  trackMetaQualifiedLead,
  trackWaitlistEvent,
} from "./meta-pixel";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LONG_TEXT_LENGTH = 750;
const MAX_OTHER_LENGTH = 160;

type FlowStage =
  | "email"
  | "invitation"
  | "survey"
  | "completed"
  | "finished"
  | "skipped";
type RequestStatus = "idle" | "submitting" | "error";
type FieldErrors = Partial<
  Record<"email" | "primaryInterest" | "monitoringMethod" | "firstName", string>
>;

type WaitlistFlowContextValue = {
  stage: FlowStage;
  activePlacement: string | null;
  surveyStep: number;
  email: string;
  primaryInterest: string;
  primaryInterestOther: string;
  monitoringMethod: string;
  monitoringMethodOther: string;
  frustration: string;
  researchCall: string;
  firstName: string;
  emailStatus: RequestStatus;
  surveyStatus: RequestStatus;
  errors: FieldErrors;
  submissionError: string;
  setEmail: (value: string) => void;
  setPrimaryInterest: (value: string) => void;
  setPrimaryInterestOther: (value: string) => void;
  setMonitoringMethod: (value: string) => void;
  setMonitoringMethodOther: (value: string) => void;
  setFrustration: (value: string) => void;
  setResearchCall: (value: string) => void;
  setFirstName: (value: string) => void;
  captureEmail: (placement: string, website: string) => Promise<void>;
  startSurvey: (placement: string) => void;
  continueSurvey: () => void;
  backSurvey: () => void;
  skipSurvey: (placement: string) => void;
  submitSurvey: (placement: string) => Promise<void>;
  finishFlow: () => void;
};

const WaitlistFlowContext = createContext<WaitlistFlowContextValue | null>(null);

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function attributionPayload() {
  const query = new URLSearchParams(window.location.search);
  return {
    utmSource: query.get("utm_source"),
    utmMedium: query.get("utm_medium"),
    utmCampaign: query.get("utm_campaign"),
    utmContent: query.get("utm_content"),
    utmTerm: query.get("utm_term"),
    metaClickId: query.get("fbclid"),
    referrer: document.referrer || null,
  };
}

async function responsePayload(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function WaitlistSignupProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<FlowStage>("email");
  const [activePlacement, setActivePlacement] = useState<string | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [email, setEmailState] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [primaryInterest, setPrimaryInterestState] = useState("");
  const [primaryInterestOther, setPrimaryInterestOther] = useState("");
  const [monitoringMethod, setMonitoringMethodState] = useState("");
  const [monitoringMethodOther, setMonitoringMethodOther] = useState("");
  const [frustration, setFrustration] = useState("");
  const [researchCall, setResearchCallState] = useState("");
  const [firstName, setFirstNameState] = useState("");
  const [emailStatus, setEmailStatus] = useState<RequestStatus>("idle");
  const [surveyStatus, setSurveyStatus] = useState<RequestStatus>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState("");
  const emailRequest = useRef<Promise<void> | null>(null);
  const surveyRequest = useRef<Promise<void> | null>(null);
  const startedTokens = useRef(new Set<string>());
  const skippedTokens = useRef(new Set<string>());

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmissionError("");
  }, []);

  const setEmail = useCallback(
    (value: string) => {
      setEmailState(value);
      clearFieldError("email");
      if (emailStatus === "error") setEmailStatus("idle");
    },
    [clearFieldError, emailStatus],
  );

  const setPrimaryInterest = useCallback(
    (value: string) => {
      setPrimaryInterestState(value);
      clearFieldError("primaryInterest");
    },
    [clearFieldError],
  );

  const setMonitoringMethod = useCallback(
    (value: string) => {
      setMonitoringMethodState(value);
      clearFieldError("monitoringMethod");
    },
    [clearFieldError],
  );

  const setResearchCall = useCallback(
    (value: string) => {
      setResearchCallState(value);
      if (value !== "yes") setFirstNameState("");
      clearFieldError("firstName");
    },
    [clearFieldError],
  );

  const setFirstName = useCallback(
    (value: string) => {
      setFirstNameState(value);
      clearFieldError("firstName");
    },
    [clearFieldError],
  );

  const captureEmail = useCallback(
    async (placement: string, website: string) => {
      if (emailRequest.current) return emailRequest.current;

      setActivePlacement(placement);
      const normalizedEmail = email.trim();
      if (
        !normalizedEmail ||
        normalizedEmail.length > 254 ||
        !EMAIL_PATTERN.test(normalizedEmail)
      ) {
        setErrors({ email: "Enter a valid email address." });
        return;
      }

      const request = (async () => {
        setErrors({});
        setSubmissionError("");
        setEmailStatus("submitting");
        trackWaitlistEvent("waitlist_email_submitted", { placement });

        try {
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "capture_email",
              email: normalizedEmail,
              website,
              placement,
              ...attributionPayload(),
            }),
          });
          const result = await responsePayload(response);
          const token = typeof result.signupToken === "string" ? result.signupToken : "";

          if (!response.ok || !token) {
            throw new Error(
              typeof result.error === "string"
                ? result.error
                : "We couldn’t save your email. Please try again.",
            );
          }

          setEmailState(normalizedEmail);
          setSignupToken(token);
          setStage("invitation");
          setEmailStatus("idle");
          trackWaitlistEvent("waitlist_email_success", {
            placement,
            result: result.leadCreated === true ? "created" : "already_registered",
          });
          if (result.leadCreated === true) trackMetaLead(token);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "We couldn’t save your email. Please try again.";
          setSubmissionError(message);
          setEmailStatus("error");
          trackWaitlistEvent("waitlist_email_error", { placement });
        }
      })();

      emailRequest.current = request;
      try {
        await request;
      } finally {
        emailRequest.current = null;
      }
    },
    [email],
  );

  const startSurvey = useCallback(
    (placement: string) => {
      setActivePlacement(placement);
      setStage("survey");
      setSurveyStep(0);
      setErrors({});
      setSubmissionError("");
      if (signupToken && !startedTokens.current.has(signupToken)) {
        startedTokens.current.add(signupToken);
        trackWaitlistEvent("qualification_started", { placement });
      }
    },
    [signupToken],
  );

  const continueSurvey = useCallback(() => {
    if (surveyStep === 0 && !primaryInterest) {
      setErrors({ primaryInterest: "Choose the one main reason that matters most to you." });
      return;
    }
    if (surveyStep === 1 && !monitoringMethod) {
      setErrors({ monitoringMethod: "Choose how you currently monitor your blood pressure." });
      return;
    }
    setErrors({});
    setSubmissionError("");
    setSurveyStep((current) => Math.min(current + 1, 2));
  }, [monitoringMethod, primaryInterest, surveyStep]);

  const backSurvey = useCallback(() => {
    setErrors({});
    setSubmissionError("");
    setSurveyStep((current) => Math.max(current - 1, 0));
  }, []);

  const skipSurvey = useCallback(
    (placement: string) => {
      setStage("skipped");
      setActivePlacement(placement);
      if (signupToken && !skippedTokens.current.has(signupToken)) {
        skippedTokens.current.add(signupToken);
        trackWaitlistEvent("qualification_skipped", { placement });
        void fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "skip_qualification",
            signupToken,
          }),
        });
      }
    },
    [signupToken],
  );

  const submitSurvey = useCallback(
    async (placement: string) => {
      if (surveyRequest.current) return surveyRequest.current;

      const nextErrors: FieldErrors = {};
      if (!primaryInterest) {
        nextErrors.primaryInterest = "Choose the one main reason that matters most to you.";
      }
      if (!monitoringMethod) {
        nextErrors.monitoringMethod = "Choose how you currently monitor your blood pressure.";
      }
      if (researchCall === "yes" && !cleanName(firstName)) {
        nextErrors.firstName = "Enter your first name so we know how to address you.";
      }
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }

      const request = (async () => {
        setErrors({});
        setSubmissionError("");
        setSurveyStatus("submitting");

        try {
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "submit_qualification",
              signupToken,
              primaryInterest,
              primaryInterestOther: primaryInterestOther.trim(),
              monitoringMethod,
              monitoringMethodOther: monitoringMethodOther.trim(),
              frustration: frustration.trim(),
              researchCall: researchCall || null,
              firstName: researchCall === "yes" ? cleanName(firstName) : null,
            }),
          });
          const result = await responsePayload(response);
          if (!response.ok || typeof result.status !== "string") {
            throw new Error(
              typeof result.error === "string"
                ? result.error
                : "We couldn’t save your answers. Please try again.",
            );
          }

          setSurveyStatus("idle");
          setStage("completed");
          setActivePlacement(placement);
          if (result.qualifiedLeadCreated === true) {
            trackWaitlistEvent("qualification_completed", { placement });
            trackMetaQualifiedLead(signupToken);
          }
        } catch (error) {
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "We couldn’t save your answers. Please try again.",
          );
          setSurveyStatus("error");
        }
      })();

      surveyRequest.current = request;
      try {
        await request;
      } finally {
        surveyRequest.current = null;
      }
    },
    [
      firstName,
      frustration,
      monitoringMethod,
      monitoringMethodOther,
      primaryInterest,
      primaryInterestOther,
      researchCall,
      signupToken,
    ],
  );

  const value = useMemo<WaitlistFlowContextValue>(
    () => ({
      stage,
      activePlacement,
      surveyStep,
      email,
      primaryInterest,
      primaryInterestOther,
      monitoringMethod,
      monitoringMethodOther,
      frustration,
      researchCall,
      firstName,
      emailStatus,
      surveyStatus,
      errors,
      submissionError,
      setEmail,
      setPrimaryInterest,
      setPrimaryInterestOther,
      setMonitoringMethod,
      setMonitoringMethodOther,
      setFrustration,
      setResearchCall,
      setFirstName,
      captureEmail,
      startSurvey,
      continueSurvey,
      backSurvey,
      skipSurvey,
      submitSurvey,
      finishFlow: () => setStage("finished"),
    }),
    [
      activePlacement,
      backSurvey,
      captureEmail,
      continueSurvey,
      email,
      emailStatus,
      errors,
      firstName,
      frustration,
      monitoringMethod,
      monitoringMethodOther,
      primaryInterest,
      primaryInterestOther,
      researchCall,
      setEmail,
      setFirstName,
      setMonitoringMethod,
      setPrimaryInterest,
      setResearchCall,
      skipSurvey,
      stage,
      startSurvey,
      submissionError,
      submitSurvey,
      surveyStatus,
      surveyStep,
    ],
  );

  return (
    <WaitlistFlowContext.Provider value={value}>
      {children}
    </WaitlistFlowContext.Provider>
  );
}

function useWaitlistFlow() {
  const value = useContext(WaitlistFlowContext);
  if (!value) {
    throw new Error("WaitlistSignupFlow must be rendered inside WaitlistSignupProvider.");
  }
  return value;
}

function ChoiceList({
  idPrefix,
  name,
  options,
  value,
  error,
  onChange,
}: {
  idPrefix: string;
  name: string;
  options: readonly (readonly [string, string])[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset
      className="waitlist-signup__choices"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${idPrefix}-${name}-error` : undefined}
    >
      <legend className="sr-only">Choose one option</legend>
      {options.map(([optionValue, label]) => (
        <label className="waitlist-signup__choice" key={optionValue}>
          <input
            type="radio"
            name={`${idPrefix}-${name}`}
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

export function WaitlistSignupFlow({
  placement,
  tone = "dark",
  showFoundingContributorOffer = false,
  finishHref = "#product",
}: {
  placement: string;
  tone?: "dark" | "light";
  showFoundingContributorOffer?: boolean;
  finishHref?: string;
}) {
  const flow = useWaitlistFlow();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewed = useRef(false);
  const idPrefix = placement.replaceAll("_", "-");
  const isActivePlacement = flow.activePlacement === placement;
  const isActiveSurvey =
    flow.stage !== "survey" || flow.activePlacement === placement;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || viewed.current) return;

    const recordView = () => {
      if (viewed.current) return;
      viewed.current = true;
      trackWaitlistEvent("waitlist_form_viewed", { placement });
    };
    if (!("IntersectionObserver" in window)) {
      recordView();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          recordView();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [placement]);

  useEffect(() => {
    if (
      flow.activePlacement === placement &&
      flow.stage !== "email" &&
      flow.emailStatus !== "submitting" &&
      flow.surveyStatus !== "submitting"
    ) {
      headingRef.current?.focus();
    }
  }, [
    flow.activePlacement,
    flow.emailStatus,
    flow.stage,
    flow.surveyStatus,
    flow.surveyStep,
    placement,
  ]);

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void flow.captureEmail(placement, String(formData.get("website") ?? ""));
  }

  function activateSurveyHere() {
    flow.startSurvey(placement);
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "center" }));
  }

  const title = [
    "What is the main reason you are interested in Frame?",
    "How do you currently monitor your blood pressure?",
    "What is most frustrating or missing from the way you currently understand your blood pressure?",
  ][flow.surveyStep];

  return (
    <div
      className={`waitlist-signup waitlist-signup--${tone} waitlist-signup--${flow.stage}`}
      id={`${idPrefix}-waitlist`}
      ref={rootRef}
    >
      {flow.stage === "email" ? (
        <>
          <div className="waitlist-signup__intro">
            <strong>Join Frame early access</strong>
            <p>Get development updates and the opportunity to help shape Frame.</p>
          </div>
          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="honeypot" aria-hidden="true">
              <label htmlFor={`${idPrefix}-website`}>Website</label>
              <input
                id={`${idPrefix}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="form-field waitlist-signup__email-field">
              <label htmlFor={`${idPrefix}-email`}>Email address</label>
              <div className="waitlist-signup__email-row">
                <input
                  id={`${idPrefix}-email`}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={flow.email}
                  onChange={(event) => flow.setEmail(event.target.value)}
                  maxLength={254}
                  aria-invalid={Boolean(isActivePlacement && flow.errors.email)}
                  aria-describedby={
                    isActivePlacement && flow.errors.email
                      ? `${idPrefix}-email-error`
                      : `${idPrefix}-email-note`
                  }
                />
                <button
                  className={`button ${tone === "light" ? "button--light" : "button--dark"}`}
                  type="submit"
                  disabled={flow.emailStatus === "submitting"}
                >
                  {flow.emailStatus === "submitting" ? "Joining…" : "Join early access"}
                </button>
              </div>
              {isActivePlacement && flow.errors.email ? (
                <p className="form-error" id={`${idPrefix}-email-error`} role="alert">
                  {flow.errors.email}
                </p>
              ) : null}
            </div>
            <p className="form-note" id={`${idPrefix}-email-note`}>
              Development updates only. Unsubscribe anytime. <a href="/privacy">Privacy</a>
            </p>
            <p className="waitlist-signup__live" aria-live="assertive">
              {isActivePlacement ? flow.submissionError : ""}
            </p>
          </form>
        </>
      ) : null}

      {flow.stage === "invitation" ? (
        <div className="waitlist-signup__state" aria-live={isActivePlacement ? "polite" : "off"}>
          <p className="eyebrow">Early access confirmed</p>
          <h3 ref={headingRef} tabIndex={-1}>You’re on the list.</h3>
          <div className="waitlist-signup__survey-invitation">
            <h4>Help shape Frame</h4>
            <p>
              Answer three short questions to help us build something genuinely useful.
              It should take about a minute. Your place is already secured.
            </p>
          </div>
          <div className="waitlist-signup__actions">
            <button className={`button ${tone === "light" ? "button--light" : "button--dark"}`} type="button" onClick={activateSurveyHere}>
              Answer the questions
            </button>
            <button className="waitlist-signup__text-button" type="button" onClick={() => flow.skipSurvey(placement)}>
              Maybe later
            </button>
          </div>
        </div>
      ) : null}

      {flow.stage === "survey" && !isActiveSurvey ? (
        <div className="waitlist-signup__state">
          <p className="eyebrow">Early access confirmed</p>
          <h3>You’re on the list.</h3>
          <p>The optional questions are open in the other signup section.</p>
          <button className="waitlist-signup__text-button" type="button" onClick={activateSurveyHere}>
            Answer them here instead
          </button>
        </div>
      ) : null}

      {flow.stage === "survey" && isActiveSurvey ? (
        <form className="waitlist-signup__survey" onSubmit={(event) => { event.preventDefault(); void flow.submitSurvey(placement); }} noValidate>
          <div className="waitlist-signup__secured" role="status">
            <span aria-hidden="true">✓</span> You’re already on the early-access list
          </div>
          <div className="waitlist-signup__progress" aria-label={`Question ${flow.surveyStep + 1} of 3`}>
            <span>0{flow.surveyStep + 1}</span>
            <div><i style={{ width: `${((flow.surveyStep + 1) / 3) * 100}%` }} /></div>
            <span>03</span>
          </div>
          <h3 ref={headingRef} tabIndex={-1}>{title}</h3>

          {flow.surveyStep === 0 ? (
            <>
              <ChoiceList
                idPrefix={idPrefix}
                name="primary-interest"
                options={PRIMARY_INTEREST_OPTIONS}
                value={flow.primaryInterest}
                error={flow.errors.primaryInterest}
                onChange={flow.setPrimaryInterest}
              />
              {flow.primaryInterest === "something_else" ? (
                <div className="form-field waitlist-signup__other-field">
                  <label htmlFor={`${idPrefix}-primary-interest-other`}>Please specify <span>(optional)</span></label>
                  <input id={`${idPrefix}-primary-interest-other`} type="text" value={flow.primaryInterestOther} onChange={(event) => flow.setPrimaryInterestOther(event.target.value)} maxLength={MAX_OTHER_LENGTH} />
                </div>
              ) : null}
            </>
          ) : null}

          {flow.surveyStep === 1 ? (
            <>
              <ChoiceList
                idPrefix={idPrefix}
                name="monitoring-method"
                options={MONITORING_METHOD_OPTIONS}
                value={flow.monitoringMethod}
                error={flow.errors.monitoringMethod}
                onChange={flow.setMonitoringMethod}
              />
              {flow.monitoringMethod === "something_else" ? (
                <div className="form-field waitlist-signup__other-field">
                  <label htmlFor={`${idPrefix}-monitoring-other`}>Please specify <span>(optional)</span></label>
                  <input id={`${idPrefix}-monitoring-other`} type="text" value={flow.monitoringMethodOther} onChange={(event) => flow.setMonitoringMethodOther(event.target.value)} maxLength={MAX_OTHER_LENGTH} />
                </div>
              ) : null}
            </>
          ) : null}

          {flow.surveyStep === 2 ? (
            <div className="waitlist-signup__final-questions">
              <div className="form-field">
                <label htmlFor={`${idPrefix}-frustration`}>Your answer <span>(optional)</span></label>
                <textarea
                  id={`${idPrefix}-frustration`}
                  value={flow.frustration}
                  onChange={(event) => flow.setFrustration(event.target.value)}
                  maxLength={MAX_LONG_TEXT_LENGTH}
                  placeholder="For example, you only get occasional readings, the cuff is inconvenient, or you cannot see how your blood pressure responds to everyday life."
                  aria-describedby={`${idPrefix}-frustration-note`}
                />
                <div className="field-hint" id={`${idPrefix}-frustration-note`}>
                  <span>Please don’t include private medical information.</span>
                  <span>{flow.frustration.length}/{MAX_LONG_TEXT_LENGTH}</span>
                </div>
              </div>
              <fieldset className="waitlist-signup__research-call">
                <legend>Would you be open to a short user-research call? <span>(optional)</span></legend>
                <div>
                  {RESEARCH_CALL_OPTIONS.map(([value, label]) => (
                    <label key={value}>
                      <input type="radio" name={`${idPrefix}-research-call`} value={value} checked={flow.researchCall === value} onChange={() => flow.setResearchCall(value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {flow.researchCall === "yes" ? (
                <div className="form-field waitlist-signup__first-name">
                  <label htmlFor={`${idPrefix}-first-name`}>First name</label>
                  <input id={`${idPrefix}-first-name`} type="text" autoComplete="given-name" value={flow.firstName} onChange={(event) => flow.setFirstName(event.target.value)} maxLength={60} aria-invalid={Boolean(flow.errors.firstName)} aria-describedby={flow.errors.firstName ? `${idPrefix}-first-name-error` : undefined} />
                  {flow.errors.firstName ? <p className="form-error" id={`${idPrefix}-first-name-error`} role="alert">{flow.errors.firstName}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="waitlist-signup__live" aria-live="assertive">{flow.submissionError}</p>
          <div className="waitlist-signup__survey-actions">
            <button className="waitlist-signup__text-button" type="button" onClick={() => flow.skipSurvey(placement)} disabled={flow.surveyStatus === "submitting"}>
              Skip and finish
            </button>
            <div>
              {flow.surveyStep > 0 ? <button className="waitlist-signup__text-button" type="button" onClick={flow.backSurvey} disabled={flow.surveyStatus === "submitting"}>Back</button> : null}
              {flow.surveyStep < 2 ? (
                <button className={`button ${tone === "light" ? "button--light" : "button--dark"}`} type="button" onClick={flow.continueSurvey}>Continue</button>
              ) : (
                <button className={`button ${tone === "light" ? "button--light" : "button--dark"}`} type="submit" disabled={flow.surveyStatus === "submitting"}>
                  {flow.surveyStatus === "submitting" ? "Submitting…" : "Submit answers"}
                </button>
              )}
            </div>
          </div>
        </form>
      ) : null}

      {flow.stage === "completed" ? (
        <div className="waitlist-signup__state" aria-live={isActivePlacement ? "polite" : "off"}>
          <p className="eyebrow">Thank you</p>
          <h3 ref={headingRef} tabIndex={-1}>Your feedback will help shape Frame.</h3>
          <p>You’re on the early-access list and your answers have been saved.</p>
          <div className="waitlist-signup__actions">
            <button className={`button ${tone === "light" ? "button--light" : "button--dark"}`} type="button" onClick={flow.finishFlow}>Finish</button>
          </div>
          {showFoundingContributorOffer ? (
            <aside className="interest-flow__membership-offer">
              <p className="eyebrow">Want to go further?</p>
              <h4>Become a Founding Contributor</h4>
              <p>Join Frame’s private development community for 12 months. The one-time $99 membership supports the work; it is not a product purchase or preorder.</p>
              <Link href="/founding-contributors?source=waitlist_success" className="text-link">See what membership includes <span aria-hidden="true">↗</span></Link>
            </aside>
          ) : null}
        </div>
      ) : null}

      {flow.stage === "skipped" || flow.stage === "finished" ? (
        <div className="waitlist-signup__state" aria-live={isActivePlacement ? "polite" : "off"}>
          <p className="eyebrow">Early access confirmed</p>
          <h3 ref={headingRef} tabIndex={-1}>You’re on the list.</h3>
          <p>{flow.stage === "finished" ? "Thank you for helping shape Frame." : "No problem—you can answer the optional questions another time."}</p>
          <a className="waitlist-signup__text-button" href={finishHref}>Continue exploring Frame</a>
        </div>
      ) : null}
    </div>
  );
}
