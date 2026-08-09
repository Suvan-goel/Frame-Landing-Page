"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  GENDER_OPTIONS,
  MONITORING_METHOD_OPTIONS,
  PRIMARY_INTEREST_OPTIONS,
  RESEARCH_CALL_OPTIONS,
  genderValues,
} from "@/lib/waitlist-options";
import {
  trackMetaLead,
  trackMetaQualifiedLead,
  trackWaitlistEvent,
} from "./meta-pixel";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LONG_TEXT_LENGTH = 750;
const MIN_FRUSTRATION_LENGTH = 20;
const MIN_AGE = 18;
const MAX_AGE = 120;
const WAITLIST_SURVEY_SESSION_KEY = "frame_waitlist_survey";

type FlowStage =
  | "email"
  | "survey"
  | "completed"
  | "finished"
  | "skipped";
type RequestStatus = "idle" | "submitting" | "error";
type SurveyResumeStatus = "loading" | "ready" | "missing";
type FieldErrors = Partial<
  Record<
    | "email"
    | "primaryInterest"
    | "monitoringMethod"
    | "frustration"
    | "firstName"
    | "lastName"
    | "age"
    | "gender",
    string
  >
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
  lastName: string;
  age: string;
  gender: string;
  emailStatus: RequestStatus;
  surveyStatus: RequestStatus;
  surveyResumeStatus: SurveyResumeStatus;
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
  setLastName: (value: string) => void;
  setAge: (value: string) => void;
  setGender: (value: string) => void;
  captureEmail: (placement: string, website: string) => Promise<void>;
  continueSurvey: () => void;
  backSurvey: () => void;
  skipSurvey: (placement: string) => void;
  submitSurvey: (placement: string) => Promise<void>;
  finishFlow: () => void;
};

type StoredWaitlistSurvey = {
  email: string;
  signupToken: string;
  qualificationStarted: boolean;
};

const WaitlistFlowContext = createContext<WaitlistFlowContextValue | null>(null);

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function profileErrors(
  firstName: string,
  lastName: string,
  age: string,
  gender: string,
) {
  const nextErrors: FieldErrors = {};
  const normalizedAge = age.trim();
  const parsedAge = Number(normalizedAge);

  if (!cleanName(firstName) || cleanName(firstName).length > 60) {
    nextErrors.firstName = "Enter your first name.";
  }
  if (!cleanName(lastName) || cleanName(lastName).length > 60) {
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
  if (!genderValues.has(gender)) {
    nextErrors.gender = "Select a gender option.";
  }
  return nextErrors;
}

function storeWaitlistSurveySession(value: StoredWaitlistSurvey) {
  try {
    window.sessionStorage.setItem(WAITLIST_SURVEY_SESSION_KEY, JSON.stringify(value));
  } catch {
    // The email is still captured if browser storage is unavailable.
  }
}

function clearWaitlistSurveySession() {
  try {
    window.sessionStorage.removeItem(WAITLIST_SURVEY_SESSION_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
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

export function WaitlistSignupProvider({
  children,
  resumeSurvey = false,
  resumePlacement = "qualification_page",
}: {
  children: ReactNode;
  resumeSurvey?: boolean;
  resumePlacement?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<FlowStage>("email");
  const [activePlacement, setActivePlacement] = useState<string | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [email, setEmailState] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [primaryInterest, setPrimaryInterestState] = useState("");
  const [primaryInterestOther, setPrimaryInterestOther] = useState("");
  const [monitoringMethod, setMonitoringMethodState] = useState("");
  const [monitoringMethodOther, setMonitoringMethodOther] = useState("");
  const [frustration, setFrustrationState] = useState("");
  const [researchCall, setResearchCallState] = useState("");
  const [firstName, setFirstNameState] = useState("");
  const [lastName, setLastNameState] = useState("");
  const [age, setAgeState] = useState("");
  const [gender, setGenderState] = useState("");
  const [emailStatus, setEmailStatus] = useState<RequestStatus>("idle");
  const [surveyStatus, setSurveyStatus] = useState<RequestStatus>("idle");
  const [surveyResumeStatus, setSurveyResumeStatus] =
    useState<SurveyResumeStatus>(resumeSurvey ? "loading" : "ready");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState("");
  const emailRequest = useRef<Promise<void> | null>(null);
  const surveyRequest = useRef<Promise<void> | null>(null);
  const skippedTokens = useRef(new Set<string>());

  useEffect(() => {
    if (!resumeSurvey) return;

    const restoreSurvey = window.setTimeout(() => {
      let stored: StoredWaitlistSurvey | null = null;
      try {
        stored = JSON.parse(
          window.sessionStorage.getItem(WAITLIST_SURVEY_SESSION_KEY) ?? "null",
        ) as StoredWaitlistSurvey | null;
      } catch {
        stored = null;
      }

      if (!stored?.email || !stored.signupToken) {
        setSurveyResumeStatus("missing");
        return;
      }

      setEmailState(stored.email);
      setSignupToken(stored.signupToken);
      setActivePlacement(resumePlacement);
      setStage("survey");
      setSurveyResumeStatus("ready");

      if (!stored.qualificationStarted) {
        trackWaitlistEvent("qualification_started", { placement: resumePlacement });
        storeWaitlistSurveySession({ ...stored, qualificationStarted: true });
      }
    }, 0);

    return () => window.clearTimeout(restoreSurvey);
  }, [resumePlacement, resumeSurvey]);

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

  const setFrustration = useCallback(
    (value: string) => {
      setFrustrationState(value);
      clearFieldError("frustration");
    },
    [clearFieldError],
  );

  const setResearchCall = useCallback(
    (value: string) => {
      setResearchCallState(value);
    },
    [],
  );

  const setFirstName = useCallback(
    (value: string) => {
      setFirstNameState(value);
      clearFieldError("firstName");
    },
    [clearFieldError],
  );

  const setLastName = useCallback(
    (value: string) => {
      setLastNameState(value);
      clearFieldError("lastName");
    },
    [clearFieldError],
  );

  const setAge = useCallback(
    (value: string) => {
      setAgeState(value);
      clearFieldError("age");
    },
    [clearFieldError],
  );

  const setGender = useCallback(
    (value: string) => {
      setGenderState(value);
      clearFieldError("gender");
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
          storeWaitlistSurveySession({
            email: normalizedEmail,
            signupToken: token,
            qualificationStarted: false,
          });
          trackWaitlistEvent("waitlist_email_success", {
            placement,
            result: result.leadCreated === true ? "created" : "already_registered",
          });
          if (result.leadCreated === true) trackMetaLead(token);
          router.push("/early-access/questions");
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
    [email, router],
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
    if (surveyStep === 2 && frustration.trim().length < MIN_FRUSTRATION_LENGTH) {
      setErrors({ frustration: "Write at least 20 characters before continuing." });
      return;
    }
    setErrors({});
    setSubmissionError("");
    setSurveyStep((current) => Math.min(current + 1, 4));
  }, [frustration, monitoringMethod, primaryInterest, surveyStep]);

  const backSurvey = useCallback(() => {
    setErrors({});
    setSubmissionError("");
    setSurveyStep((current) => Math.max(current - 1, 0));
  }, []);

  const skipSurvey = useCallback(
    (placement: string) => {
      setStage("skipped");
      setActivePlacement(placement);
      clearWaitlistSurveySession();
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
      if (surveyStep < 4) return;

      const nextErrors = profileErrors(firstName, lastName, age, gender);
      if (!primaryInterest) {
        nextErrors.primaryInterest = "Choose the one main reason that matters most to you.";
      }
      if (!monitoringMethod) {
        nextErrors.monitoringMethod = "Choose how you currently monitor your blood pressure.";
      }
      if (frustration.trim().length < MIN_FRUSTRATION_LENGTH) {
        nextErrors.frustration = "Write at least 20 characters before submitting.";
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
              firstName: cleanName(firstName),
              lastName: cleanName(lastName),
              age: Number(age.trim()),
              gender,
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
          clearWaitlistSurveySession();
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
      age,
      firstName,
      frustration,
      gender,
      lastName,
      monitoringMethod,
      monitoringMethodOther,
      primaryInterest,
      primaryInterestOther,
      researchCall,
      signupToken,
      surveyStep,
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
      lastName,
      age,
      gender,
      emailStatus,
      surveyStatus,
      surveyResumeStatus,
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
      setLastName,
      setAge,
      setGender,
      captureEmail,
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
      age,
      firstName,
      frustration,
      gender,
      lastName,
      monitoringMethod,
      monitoringMethodOther,
      primaryInterest,
      primaryInterestOther,
      researchCall,
      setEmail,
      setAge,
      setFirstName,
      setGender,
      setLastName,
      setMonitoringMethod,
      setPrimaryInterest,
      setResearchCall,
      setFrustration,
      skipSurvey,
      stage,
      submissionError,
      submitSurvey,
      surveyStatus,
      surveyResumeStatus,
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
      className="interest-flow__choices"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${idPrefix}-${name}-error` : undefined}
    >
      <legend className="sr-only">Choose one option</legend>
      {options.map(([optionValue, label]) => (
        <label className="interest-flow__choice" key={optionValue}>
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
  compact = false,
  showFoundingContributorOffer = false,
  finishHref = "#product",
  usePreorderLaunchCopy = false,
}: {
  placement: string;
  tone?: "dark" | "light";
  compact?: boolean;
  showFoundingContributorOffer?: boolean;
  finishHref?: string;
  usePreorderLaunchCopy?: boolean;
}) {
  const flow = useWaitlistFlow();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewed = useRef(false);
  const idPrefix = placement.replaceAll("_", "-");
  const isActivePlacement = flow.activePlacement === placement;

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

  function handleSurveySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flow.surveyStep < 4) {
      flow.continueSurvey();
      return;
    }
    void flow.submitSurvey(placement);
  }

  const title = [
    "What is the main reason you want Frame?",
    "How do you currently monitor your blood pressure?",
    "What would you want Frame to help you understand or do that you can’t easily today?",
    "Would you be willing to speak with us for 20 minutes?",
    "A little about you.",
  ][flow.surveyStep];

  const profileIsComplete =
    Boolean(cleanName(flow.firstName)) &&
    Boolean(cleanName(flow.lastName)) &&
    Number.isInteger(Number(flow.age)) &&
    Number(flow.age) >= MIN_AGE &&
    Number(flow.age) <= MAX_AGE &&
    genderValues.has(flow.gender);
  const canContinue =
    (flow.surveyStep === 0 && Boolean(flow.primaryInterest)) ||
    (flow.surveyStep === 1 && Boolean(flow.monitoringMethod)) ||
    (flow.surveyStep === 2 && flow.frustration.trim().length >= MIN_FRUSTRATION_LENGTH) ||
    (flow.surveyStep === 3 && Boolean(flow.researchCall));

  return (
    <div
      className={`waitlist-signup waitlist-signup--${tone} waitlist-signup--${flow.stage}${compact ? " waitlist-signup--compact" : ""}`}
      id={`${idPrefix}-waitlist`}
      ref={rootRef}
    >
      {flow.stage === "email" ? (
        <>
          {!compact ? (
            <div className="waitlist-signup__intro">
              <strong>Get updates</strong>
              <p>
                {usePreorderLaunchCopy
                  ? "Get product milestones, launch news, and opportunities to help shape Frame."
                  : "Receive Frame development news and help shape what comes next."}
              </p>
            </div>
          ) : null}
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
              <label
                htmlFor={`${idPrefix}-email`}
                className={compact ? "sr-only" : undefined}
              >
                {compact ? "Get updates" : "Email address"}
              </label>
              <div className="waitlist-signup__email-row">
                <input
                  id={`${idPrefix}-email`}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={compact ? "Enter your email" : undefined}
                  value={flow.email}
                  onChange={(event) => flow.setEmail(event.target.value)}
                  maxLength={254}
                  aria-invalid={Boolean(isActivePlacement && flow.errors.email)}
                  aria-describedby={
                    isActivePlacement && flow.errors.email
                      ? `${idPrefix}-email-error`
                      : compact
                        ? undefined
                        : `${idPrefix}-email-note`
                  }
                />
                <button
                  className={`button ${tone === "light" ? "button--light" : "button--dark"}`}
                  type="submit"
                  disabled={flow.emailStatus === "submitting"}
                >
                  {flow.emailStatus === "submitting"
                    ? compact
                      ? "Getting updates…"
                      : "Signing up…"
                    : compact
                      ? "Get updates"
                      : "Sign up"}
                </button>
              </div>
              {isActivePlacement && flow.errors.email ? (
                <p className="form-error" id={`${idPrefix}-email-error`} role="alert">
                  {flow.errors.email}
                </p>
              ) : null}
            </div>
            {!compact ? (
              <p className="form-note" id={`${idPrefix}-email-note`}>
                {usePreorderLaunchCopy
                  ? "Product and launch updates. "
                  : "Development updates only. "}
                Unsubscribe anytime. <a href="/privacy">Privacy</a>
              </p>
            ) : null}
            <p className="waitlist-signup__live" aria-live="assertive">
              {isActivePlacement ? flow.submissionError : ""}
            </p>
          </form>
        </>
      ) : null}

      {flow.stage === "survey" ? (
        <form className="interest-flow__form" onSubmit={handleSurveySubmit} noValidate>
          <div className="interest-flow__progress" aria-label={`Step ${flow.surveyStep + 1} of 5`}>
            <span>0{flow.surveyStep + 1}</span>
            <div><i style={{ width: `${((flow.surveyStep + 1) / 5) * 100}%` }} /></div>
            <span>05</span>
          </div>
          <div className="interest-flow__content">
            <p className="eyebrow">You’re subscribed. The following questions are optional.</p>
            <h2 id={`${idPrefix}-survey-title`} ref={headingRef} tabIndex={-1}>{title}</h2>

            {flow.surveyStep === 4 ? (
              <div className="interest-flow__details">
                <p>These details help us understand who we’re hearing from.</p>
                <div className="form-name-fields">
                  <div className="form-field">
                    <label htmlFor={`${idPrefix}-first-name`}>First name</label>
                    <input id={`${idPrefix}-first-name`} name="firstName" type="text" autoComplete="given-name" value={flow.firstName} onChange={(event) => flow.setFirstName(event.target.value)} maxLength={60} required aria-invalid={Boolean(flow.errors.firstName)} aria-describedby={flow.errors.firstName ? `${idPrefix}-first-name-error` : undefined} />
                    {flow.errors.firstName ? <p className="form-error" id={`${idPrefix}-first-name-error`} role="alert">{flow.errors.firstName}</p> : null}
                  </div>
                  <div className="form-field">
                    <label htmlFor={`${idPrefix}-last-name`}>Last name</label>
                    <input id={`${idPrefix}-last-name`} name="lastName" type="text" autoComplete="family-name" value={flow.lastName} onChange={(event) => flow.setLastName(event.target.value)} maxLength={60} required aria-invalid={Boolean(flow.errors.lastName)} aria-describedby={flow.errors.lastName ? `${idPrefix}-last-name-error` : undefined} />
                    {flow.errors.lastName ? <p className="form-error" id={`${idPrefix}-last-name-error`} role="alert">{flow.errors.lastName}</p> : null}
                  </div>
                </div>
                <div className="form-demographic-fields">
                  <div className="form-field">
                    <label htmlFor={`${idPrefix}-age`}>Age</label>
                    <input id={`${idPrefix}-age`} name="age" type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} step={1} value={flow.age} onChange={(event) => flow.setAge(event.target.value)} required aria-invalid={Boolean(flow.errors.age)} aria-describedby={flow.errors.age ? `${idPrefix}-age-error` : undefined} />
                    {flow.errors.age ? <p className="form-error" id={`${idPrefix}-age-error`} role="alert">{flow.errors.age}</p> : null}
                  </div>
                  <div className="form-field">
                    <label htmlFor={`${idPrefix}-gender`}>Gender</label>
                    <select id={`${idPrefix}-gender`} name="gender" value={flow.gender} onChange={(event) => flow.setGender(event.target.value)} required aria-invalid={Boolean(flow.errors.gender)} aria-describedby={flow.errors.gender ? `${idPrefix}-gender-error` : undefined}>
                      <option value="" disabled>Select an option</option>
                      {GENDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {flow.errors.gender ? <p className="form-error" id={`${idPrefix}-gender-error`} role="alert">{flow.errors.gender}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {flow.surveyStep === 0 ? (
              <ChoiceList idPrefix={idPrefix} name="primary-interest" options={PRIMARY_INTEREST_OPTIONS} value={flow.primaryInterest} error={flow.errors.primaryInterest} onChange={flow.setPrimaryInterest} />
            ) : null}

            {flow.surveyStep === 2 ? (
              <div className="interest-flow__text-response form-field">
                <label htmlFor={`${idPrefix}-frustration`} className="sr-only">{title}</label>
                <textarea id={`${idPrefix}-frustration`} name="frustration" value={flow.frustration} onChange={(event) => flow.setFrustration(event.target.value)} required minLength={MIN_FRUSTRATION_LENGTH} maxLength={MAX_LONG_TEXT_LENGTH} aria-invalid={Boolean(flow.errors.frustration)} aria-describedby={`${idPrefix}-frustration-note${flow.errors.frustration ? ` ${idPrefix}-frustration-error` : ""}`} />
                <div className="field-hint" id={`${idPrefix}-frustration-note`}>
                  <span>Share a specific situation if you can · minimum {MIN_FRUSTRATION_LENGTH} characters</span>
                  <span>{flow.frustration.trim().length}/{MAX_LONG_TEXT_LENGTH}</span>
                </div>
                {flow.errors.frustration ? <p className="form-error" id={`${idPrefix}-frustration-error`} role="alert">{flow.errors.frustration}</p> : null}
                <p className="interest-flow__privacy-note">Please don’t include private medical information.</p>
              </div>
            ) : null}

            {flow.surveyStep === 1 ? (
              <ChoiceList idPrefix={idPrefix} name="monitoring-method" options={MONITORING_METHOD_OPTIONS} value={flow.monitoringMethod} error={flow.errors.monitoringMethod} onChange={flow.setMonitoringMethod} />
            ) : null}

            {flow.surveyStep === 3 ? (
              <ChoiceList idPrefix={idPrefix} name="research-call" options={RESEARCH_CALL_OPTIONS} value={flow.researchCall} onChange={flow.setResearchCall} />
            ) : null}
          </div>

          {flow.submissionError ? <p className="form-error form-error--submission" role="alert">{flow.submissionError}</p> : null}
          <footer className="interest-flow__actions">
            {flow.surveyStep > 0 ? (
              <button className="interest-flow__back" type="button" onClick={flow.backSurvey} disabled={flow.surveyStatus === "submitting"}>Back</button>
            ) : null}
            {flow.surveyStep < 4 ? (
              <button className="button button--dark" type="submit" disabled={!canContinue}>Continue</button>
            ) : (
              <button className="button button--dark" type="submit" disabled={!profileIsComplete || flow.surveyStatus === "submitting"}>
                {flow.surveyStatus === "submitting" ? "Submitting…" : "Submit answers"}
              </button>
            )}
          </footer>
        </form>
      ) : null}

      {flow.stage === "completed" ? (
        <div className="interest-flow__success" aria-live={isActivePlacement ? "polite" : "off"}>
          <p className="eyebrow">Thank you</p>
          <h2 ref={headingRef} tabIndex={-1}>Your answers have been saved.</h2>
          <p>
            {usePreorderLaunchCopy
              ? "We read every response. Your input will help shape the Frame experience."
              : "We read every response. Your input will help shape Frame’s development."}
          </p>
          <div className="interest-flow__success-actions">
            <Link className="button button--dark" href={finishHref}><span aria-hidden="true">←</span> Back to home</Link>
          </div>
          {showFoundingContributorOffer ? (
            <aside className="interest-flow__membership-offer">
              <p className="eyebrow">Want to go further?</p>
              <h3>Become a Founding Contributor</h3>
              <p>Join Frame’s private development community for 12 months. The one-time $99 membership supports the work; it is not a product purchase or preorder.</p>
              <Link href="/founding-contributors?source=waitlist_success" className="text-link">See what membership includes <span aria-hidden="true">↗</span></Link>
            </aside>
          ) : null}
        </div>
      ) : null}

      {flow.stage === "skipped" || flow.stage === "finished" ? (
        <div className="interest-flow__success" aria-live={isActivePlacement ? "polite" : "off"}>
          <p className="eyebrow">Updates confirmed</p>
          <h2 ref={headingRef} tabIndex={-1}>You’re subscribed.</h2>
          <p>{flow.stage === "finished" ? "Thank you for helping shape Frame." : "No problem. You can answer the optional questions another time."}</p>
          <div className="interest-flow__success-actions">
            <Link className="button button--dark" href={finishHref}><span aria-hidden="true">←</span> Back to home</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WaitlistQualificationFlow({
  placement,
  finishHref = "/",
}: {
  placement: string;
  finishHref?: string;
}) {
  const flow = useWaitlistFlow();

  if (flow.surveyResumeStatus === "loading") {
    return (
      <div className="qualification-page__loading" role="status" aria-live="polite">
        Preparing your questions…
      </div>
    );
  }

  if (flow.surveyResumeStatus === "missing") {
    return (
      <div className="qualification-page__message">
        <p className="eyebrow">Optional research survey</p>
        <h1>Start with your email.</h1>
        <p>Sign up for Frame updates first, then you can answer the optional questions.</p>
        <Link className="button button--dark" href="/#homepage-hero-waitlist">
          Return to Frame
        </Link>
      </div>
    );
  }

  return <WaitlistSignupFlow placement={placement} finishHref={finishHref} />;
}
