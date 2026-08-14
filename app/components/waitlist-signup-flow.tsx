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
  MONITORING_FREQUENCY_OPTIONS,
  MONITORING_METHOD_OPTIONS,
  MONITORING_OUTCOME_OPTIONS,
  MONITORING_READINESS_OPTIONS,
  MONITORING_REASON_OPTIONS,
  PREORDER_DECLINE_REASON_OPTIONS,
  QUALITATIVE_FOLLOW_UP_OUTCOMES,
  EVIDENCE_REQUIREMENT_OPTIONS,
  RESEARCH_CALL_OPTIONS,
  WILLINGNESS_TO_PAY_OPTIONS,
} from "@/lib/waitlist-options";
import {
  getMetaTrackingContext,
  trackMetaLead,
  trackWaitlistEvent,
} from "./meta-pixel";
import { recordLandingDiagnostic } from "./landing-diagnostics.client";
import { requestTrackingPolicyAttestation } from "@/lib/geo-attestation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUALITATIVE_DETAIL_LENGTH = 300;
const WAITLIST_SURVEY_SESSION_KEY = "frame_waitlist_survey";
const MEASURED_SURVEY_STEPS = 4;
const NEVER_MEASURED_SURVEY_STEPS = 2;
const FINAL_MEASURED_STEP = 3;
const FINAL_NEVER_MEASURED_STEP = 1;
const LOCAL_PREVIEW_SIGNUP_TOKEN = "local-survey-preview";

type FlowStage =
  | "email"
  | "survey"
  | "completed"
  | "preorder_decline"
  | "finished"
  | "skipped";
type RequestStatus = "idle" | "submitting" | "error";
type SurveyResumeStatus = "loading" | "ready" | "missing";
type SurveyField =
  | "email"
  | "monitoringFrequency"
  | "monitoringReason"
  | "monitoringReadiness"
  | "monitoringMethod"
  | "monitoringOutcome";
type FieldErrors = Partial<Record<SurveyField, string>>;

type WaitlistFlowContextValue = {
  stage: FlowStage;
  activePlacement: string | null;
  surveyStep: number;
  surveySteps: number;
  email: string;
  monitoringFrequency: string;
  monitoringReason: string;
  monitoringReadiness: string;
  monitoringMethod: string;
  monitoringOutcome: string;
  qualitativeDetail: string;
  preorderDeclineReason: string;
  preorderDeclineDetail: string;
  preorderDeclineStep: number;
  willingnessToPayBand: string;
  evidenceRequirements: string[];
  evidenceRequirementsOther: string;
  openToResearchCall: string;
  emailStatus: RequestStatus;
  surveyStatus: RequestStatus;
  surveyResumeStatus: SurveyResumeStatus;
  errors: FieldErrors;
  submissionError: string;
  setEmail: (value: string) => void;
  setMonitoringFrequency: (value: string) => void;
  setMonitoringReason: (value: string) => void;
  setMonitoringReadiness: (value: string) => void;
  setMonitoringMethod: (value: string) => void;
  setMonitoringOutcome: (value: string) => void;
  setQualitativeDetail: (value: string) => void;
  setPreorderDeclineReason: (value: string) => void;
  setPreorderDeclineDetail: (value: string) => void;
  setWillingnessToPayBand: (value: string) => void;
  toggleEvidenceRequirement: (value: string) => void;
  setEvidenceRequirementsOther: (value: string) => void;
  setOpenToResearchCall: (value: string) => void;
  continuePreorderDecline: () => void;
  backPreorderDecline: () => void;
  captureEmail: (placement: string, website: string) => Promise<void>;
  continueSurvey: () => void;
  backSurvey: () => void;
  skipSurvey: (placement: string) => void;
  submitSurvey: (placement: string) => Promise<void>;
  beginPreorderDecline: (placement: string) => void;
  submitPreorderDecline: (placement: string) => Promise<void>;
};

type StoredWaitlistSurvey = {
  email: string;
  signupToken: string;
  qualificationStarted: boolean;
};

const WaitlistFlowContext = createContext<WaitlistFlowContextValue | null>(null);

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
  previewSurvey = false,
  resumeSurvey = false,
  resumePlacement = "qualification_page",
}: {
  children: ReactNode;
  previewSurvey?: boolean;
  resumeSurvey?: boolean;
  resumePlacement?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<FlowStage>("email");
  const [activePlacement, setActivePlacement] = useState<string | null>(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [email, setEmailState] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [monitoringFrequency, setMonitoringFrequencyState] = useState("");
  const [monitoringReason, setMonitoringReasonState] = useState("");
  const [monitoringReadiness, setMonitoringReadinessState] = useState("");
  const [monitoringMethod, setMonitoringMethodState] = useState("");
  const [monitoringOutcome, setMonitoringOutcomeState] = useState("");
  const [qualitativeDetail, setQualitativeDetailState] = useState("");
  const [preorderDeclineReason, setPreorderDeclineReasonState] = useState("");
  const [preorderDeclineDetail, setPreorderDeclineDetailState] = useState("");
  const [preorderDeclineStep, setPreorderDeclineStep] = useState(0);
  const [willingnessToPayBand, setWillingnessToPayBandState] = useState("");
  const [evidenceRequirements, setEvidenceRequirements] = useState<string[]>([]);
  const [evidenceRequirementsOther, setEvidenceRequirementsOtherState] =
    useState("");
  const [openToResearchCall, setOpenToResearchCallState] = useState("");
  const [emailStatus, setEmailStatus] = useState<RequestStatus>("idle");
  const [surveyStatus, setSurveyStatus] = useState<RequestStatus>("idle");
  const [surveyResumeStatus, setSurveyResumeStatus] =
    useState<SurveyResumeStatus>(resumeSurvey ? "loading" : "ready");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState("");
  const emailRequest = useRef<Promise<void> | null>(null);
  const surveyRequest = useRef<Promise<void> | null>(null);
  const skippedTokens = useRef(new Set<string>());
  const analyticsSelections = useRef(new Set<string>());
  const surveyStarted = useRef(false);
  const neverMeasured = monitoringFrequency === "never_outside_appointment";
  const surveySteps = neverMeasured
    ? NEVER_MEASURED_SURVEY_STEPS
    : MEASURED_SURVEY_STEPS;

  useEffect(() => {
    if (!resumeSurvey) return;

    const restoreSurvey = window.setTimeout(() => {
      const localPreviewRequested =
        previewSurvey &&
        ["localhost", "127.0.0.1", "::1"].includes(
          window.location.hostname.toLowerCase(),
        );

      if (localPreviewRequested) {
        setEmailState("preview@framewearable.com");
        setSignupToken(LOCAL_PREVIEW_SIGNUP_TOKEN);
        setActivePlacement(resumePlacement);
        setStage("survey");
        setSurveyResumeStatus("ready");
        return;
      }

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
      surveyStarted.current = stored.qualificationStarted;
    }, 0);

    return () => window.clearTimeout(restoreSurvey);
  }, [previewSurvey, resumePlacement, resumeSurvey]);

  useEffect(() => {
    if (
      stage !== "survey" ||
      !monitoringFrequency ||
      !signupToken ||
      surveyStarted.current
    ) {
      return;
    }
    surveyStarted.current = true;
    trackWaitlistEvent("qualification_started", {
      placement: activePlacement ?? resumePlacement,
    });
    if (signupToken !== LOCAL_PREVIEW_SIGNUP_TOKEN) {
      storeWaitlistSurveySession({
        email,
        signupToken,
        qualificationStarted: true,
      });
    }
  }, [
    activePlacement,
    email,
    monitoringFrequency,
    resumePlacement,
    signupToken,
    stage,
  ]);

  const clearFieldError = useCallback((field: SurveyField) => {
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

  const setMonitoringFrequency = useCallback(
    (value: string) => {
      setMonitoringFrequencyState(value);
      clearFieldError("monitoringFrequency");
      if (value === "never_outside_appointment") {
        setMonitoringReasonState("");
        setMonitoringMethodState("");
        setMonitoringOutcomeState("");
        setQualitativeDetailState("");
      } else {
        setMonitoringReadinessState("");
      }
    },
    [clearFieldError],
  );
  const setMonitoringReason = useCallback(
    (value: string) => {
      setMonitoringReasonState(value);
      clearFieldError("monitoringReason");
    },
    [clearFieldError],
  );
  const setMonitoringReadiness = useCallback(
    (value: string) => {
      setMonitoringReadinessState(value);
      clearFieldError("monitoringReadiness");
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
  const setMonitoringOutcome = useCallback(
    (value: string) => {
      setMonitoringOutcomeState(value);
      clearFieldError("monitoringOutcome");
      if (!QUALITATIVE_FOLLOW_UP_OUTCOMES.has(value)) {
        setQualitativeDetailState("");
      }
    },
    [clearFieldError],
  );

  const setPreorderDeclineReason = useCallback(
    (value: string) => {
      setPreorderDeclineReasonState(value);
      if (value !== "another_reason") setPreorderDeclineDetailState("");
      if (value !== "price_too_high") setWillingnessToPayBandState("");
      if (value !== "need_more_evidence") {
        setEvidenceRequirements([]);
        setEvidenceRequirementsOtherState("");
      }
      setSubmissionError("");

      const eventKey = `objection:${value}`;
      if (!analyticsSelections.current.has(eventKey)) {
        analyticsSelections.current.add(eventKey);
        trackWaitlistEvent("reservation_objection_selected", {
          placement: activePlacement ?? "qualification_page",
          reason: value,
        });
        if (value === "price_too_high") {
          trackWaitlistEvent("reservation_price_objection_selected", {
            placement: activePlacement ?? "qualification_page",
          });
        } else if (value === "need_more_evidence") {
          trackWaitlistEvent("reservation_evidence_objection_selected", {
            placement: activePlacement ?? "qualification_page",
          });
        }
      }
    },
    [activePlacement],
  );

  const setPreorderDeclineDetail = useCallback((value: string) => {
    setPreorderDeclineDetailState(value);
    setSubmissionError("");
  }, []);

  const setWillingnessToPayBand = useCallback(
    (value: string) => {
      setWillingnessToPayBandState(value);
      setSubmissionError("");
      const eventKey = `willingness:${value}`;
      if (!analyticsSelections.current.has(eventKey)) {
        analyticsSelections.current.add(eventKey);
        trackWaitlistEvent("reservation_willingness_band_selected", {
          placement: activePlacement ?? "qualification_page",
          band: value,
        });
      }
    },
    [activePlacement],
  );

  const toggleEvidenceRequirement = useCallback(
    (value: string) => {
      setEvidenceRequirements((current) =>
        current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value],
      );
      setSubmissionError("");
      const eventKey = `evidence:${value}`;
      if (!analyticsSelections.current.has(eventKey)) {
        analyticsSelections.current.add(eventKey);
        trackWaitlistEvent("reservation_evidence_requirement_selected", {
          placement: activePlacement ?? "qualification_page",
          requirement: value,
        });
      }
    },
    [activePlacement],
  );

  const setEvidenceRequirementsOther = useCallback((value: string) => {
    setEvidenceRequirementsOtherState(value);
    setSubmissionError("");
  }, []);

  const setOpenToResearchCall = useCallback((value: string) => {
    setOpenToResearchCallState(value);
    setSubmissionError("");
  }, []);

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
        recordLandingDiagnostic("lead_attempted");

        try {
          const geoPolicy = await requestTrackingPolicyAttestation();
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "capture_email",
              email: normalizedEmail,
              website,
              placement,
              tracking: getMetaTrackingContext(),
              geoAttestationToken: geoPolicy.token,
              geoResolutionReason: geoPolicy.resolutionReason,
              geoRetryAttempted: geoPolicy.retryAttempted,
              geoRetrySucceeded: geoPolicy.retrySucceeded,
              ...attributionPayload(),
            }),
          });
          const result = await responsePayload(response);
          const token =
            typeof result.signupToken === "string" ? result.signupToken : "";
          const metaEventId =
            typeof result.metaEventId === "string" ? result.metaEventId : "";

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
          if (result.leadCreated === true && metaEventId) {
            trackMetaLead(metaEventId);
          }
          recordLandingDiagnostic("lead_completed");
          router.push("/early-access/questions");
        } catch (error) {
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "We couldn’t save your email. Please try again.",
          );
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
    if (surveyStep === 0 && !monitoringFrequency) {
      setErrors({
        monitoringFrequency: "Choose how often you measured your blood pressure.",
      });
      return;
    }
    if (surveyStep === 1 && neverMeasured && !monitoringReadiness) {
      setErrors({
        monitoringReadiness: "Choose the furthest step you had taken.",
      });
      return;
    }
    if (surveyStep === 1 && !neverMeasured && !monitoringReason) {
      setErrors({ monitoringReason: "Choose the main reason you measured it." });
      return;
    }
    if (surveyStep === 2 && !monitoringMethod) {
      setErrors({ monitoringMethod: "Choose what you used for that measurement." });
      return;
    }
    setErrors({});
    setSubmissionError("");
    setSurveyStep((current) => Math.min(current + 1, FINAL_MEASURED_STEP));
  }, [
    monitoringFrequency,
    monitoringMethod,
    monitoringReadiness,
    monitoringReason,
    neverMeasured,
    surveyStep,
  ]);

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
      if (
        signupToken &&
        signupToken !== LOCAL_PREVIEW_SIGNUP_TOKEN &&
        !skippedTokens.current.has(signupToken)
      ) {
        skippedTokens.current.add(signupToken);
        trackWaitlistEvent("qualification_skipped", { placement });
        void fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "skip_qualification", signupToken }),
        });
      }
    },
    [signupToken],
  );

  const submitSurvey = useCallback(
    async (placement: string) => {
      if (surveyRequest.current) return surveyRequest.current;
      const finalStep = neverMeasured
        ? FINAL_NEVER_MEASURED_STEP
        : FINAL_MEASURED_STEP;
      if (surveyStep < finalStep) return;

      const nextErrors: FieldErrors = {};
      if (!monitoringFrequency) {
        nextErrors.monitoringFrequency =
          "Choose how often you measured your blood pressure.";
      }
      if (neverMeasured && !monitoringReadiness) {
        nextErrors.monitoringReadiness = "Choose the furthest step you had taken.";
      }
      if (!neverMeasured && !monitoringReason) {
        nextErrors.monitoringReason = "Choose the main reason you measured it.";
      }
      if (!neverMeasured && !monitoringMethod) {
        nextErrors.monitoringMethod = "Choose what you used the most recent time.";
      }
      if (!neverMeasured && !monitoringOutcome) {
        nextErrors.monitoringOutcome =
          "Choose the answer that best describes that experience.";
      }
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }

      if (signupToken === LOCAL_PREVIEW_SIGNUP_TOKEN) {
        setErrors({});
        setSubmissionError("");
        setStage("completed");
        setActivePlacement(placement);
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
              monitoringFrequency,
              monitoringReason,
              monitoringReadiness,
              monitoringMethod,
              monitoringOutcome,
              qualitativeDetail: qualitativeDetail.trim(),
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
            // A completed research survey is engagement, not purchase intent.
            trackWaitlistEvent("qualification_completed", { placement });
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
      monitoringFrequency,
      monitoringMethod,
      monitoringOutcome,
      monitoringReadiness,
      monitoringReason,
      neverMeasured,
      qualitativeDetail,
      signupToken,
      surveyStep,
    ],
  );

  const beginPreorderDecline = useCallback((placement: string) => {
    setActivePlacement(placement);
    setPreorderDeclineReasonState("");
    setPreorderDeclineDetailState("");
    setPreorderDeclineStep(0);
    setWillingnessToPayBandState("");
    setEvidenceRequirements([]);
    setEvidenceRequirementsOtherState("");
    setOpenToResearchCallState("");
    analyticsSelections.current.clear();
    setSubmissionError("");
    setStage("preorder_decline");
    trackWaitlistEvent("preorder_decline_started", { placement });
  }, []);

  const continuePreorderDecline = useCallback(() => {
    if (preorderDeclineStep === 0) {
      if (!preorderDeclineReason) {
        setSubmissionError("Choose the main reason you wouldn’t reserve Frame today.");
        return;
      }
      setPreorderDeclineStep(1);
      setSubmissionError("");
      return;
    }
    if (preorderDeclineStep === 1 && preorderDeclineReason === "price_too_high") {
      if (!willingnessToPayBand) {
        setSubmissionError("Choose the price range that would feel realistic.");
        return;
      }
      setPreorderDeclineStep(2);
      setSubmissionError("");
      return;
    }
    if (
      preorderDeclineStep === 1 &&
      preorderDeclineReason === "need_more_evidence"
    ) {
      if (!evidenceRequirements.length) {
        setSubmissionError("Choose at least one type of evidence.");
        return;
      }
      setPreorderDeclineStep(2);
      setSubmissionError("");
    }
  }, [
    evidenceRequirements.length,
    preorderDeclineReason,
    preorderDeclineStep,
    willingnessToPayBand,
  ]);

  const backPreorderDecline = useCallback(() => {
    setSubmissionError("");
    setPreorderDeclineStep((current) => Math.max(0, current - 1));
  }, []);

  const submitPreorderDecline = useCallback(
    async (placement: string) => {
      if (surveyRequest.current) return surveyRequest.current;
      if (!preorderDeclineReason) {
        setSubmissionError("Choose the main reason you wouldn’t reserve Frame today.");
        return;
      }
      if (preorderDeclineReason === "price_too_high" && !willingnessToPayBand) {
        setSubmissionError("Choose the price range that would feel realistic.");
        return;
      }
      if (
        preorderDeclineReason === "need_more_evidence" &&
        !evidenceRequirements.length
      ) {
        setSubmissionError("Choose at least one type of evidence.");
        return;
      }
      if (!openToResearchCall) {
        setSubmissionError("Choose whether you would be open to a conversation.");
        return;
      }

      if (signupToken === LOCAL_PREVIEW_SIGNUP_TOKEN) {
        setStage("finished");
        setActivePlacement(placement);
        trackWaitlistEvent("preorder_decline_completed", {
          placement,
          reason: preorderDeclineReason,
        });
        return;
      }

      const request = (async () => {
        setSubmissionError("");
        setSurveyStatus("submitting");
        try {
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "record_preorder_decline",
              signupToken,
              reason: preorderDeclineReason,
              detail: preorderDeclineDetail.trim(),
              willingnessToPayBand,
              evidenceRequirements,
              evidenceRequirementsOther: evidenceRequirementsOther.trim(),
              openToResearchCall,
            }),
          });
          const result = await responsePayload(response);
          if (!response.ok || result.status !== "recorded") {
            throw new Error(
              typeof result.error === "string"
                ? result.error
                : "We couldn’t save that answer. Please try again.",
            );
          }

          setSurveyStatus("idle");
          setStage("finished");
          setActivePlacement(placement);
          trackWaitlistEvent("preorder_decline_completed", {
            placement,
            reason: preorderDeclineReason,
          });
        } catch (error) {
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "We couldn’t save that answer. Please try again.",
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
    }, [
      preorderDeclineDetail,
      preorderDeclineReason,
      willingnessToPayBand,
      evidenceRequirements,
      evidenceRequirementsOther,
      openToResearchCall,
      signupToken,
    ],
  );

  const value = useMemo<WaitlistFlowContextValue>(
    () => ({
      stage,
      activePlacement,
      surveyStep,
      surveySteps,
      email,
      monitoringFrequency,
      monitoringReason,
      monitoringReadiness,
      monitoringMethod,
      monitoringOutcome,
      qualitativeDetail,
      preorderDeclineReason,
      preorderDeclineDetail,
      preorderDeclineStep,
      willingnessToPayBand,
      evidenceRequirements,
      evidenceRequirementsOther,
      openToResearchCall,
      emailStatus,
      surveyStatus,
      surveyResumeStatus,
      errors,
      submissionError,
      setEmail,
      setMonitoringFrequency,
      setMonitoringReason,
      setMonitoringReadiness,
      setMonitoringMethod,
      setMonitoringOutcome,
      setQualitativeDetail: setQualitativeDetailState,
      setPreorderDeclineReason,
      setPreorderDeclineDetail,
      setWillingnessToPayBand,
      toggleEvidenceRequirement,
      setEvidenceRequirementsOther,
      setOpenToResearchCall,
      continuePreorderDecline,
      backPreorderDecline,
      captureEmail,
      continueSurvey,
      backSurvey,
      skipSurvey,
      submitSurvey,
      beginPreorderDecline,
      submitPreorderDecline,
    }),
    [
      activePlacement,
      backSurvey,
      captureEmail,
      continueSurvey,
      email,
      emailStatus,
      errors,
      monitoringFrequency,
      monitoringMethod,
      monitoringOutcome,
      monitoringReadiness,
      monitoringReason,
      preorderDeclineDetail,
      preorderDeclineReason,
      preorderDeclineStep,
      willingnessToPayBand,
      evidenceRequirements,
      evidenceRequirementsOther,
      openToResearchCall,
      qualitativeDetail,
      setEmail,
      setMonitoringFrequency,
      setMonitoringMethod,
      setMonitoringOutcome,
      setMonitoringReadiness,
      setMonitoringReason,
      setPreorderDeclineDetail,
      setPreorderDeclineReason,
      setWillingnessToPayBand,
      toggleEvidenceRequirement,
      setEvidenceRequirementsOther,
      setOpenToResearchCall,
      continuePreorderDecline,
      backPreorderDecline,
      skipSurvey,
      stage,
      submissionError,
      beginPreorderDecline,
      submitPreorderDecline,
      submitSurvey,
      surveyResumeStatus,
      surveyStatus,
      surveyStep,
      surveySteps,
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

function MultiChoiceList({
  idPrefix,
  name,
  options,
  values,
  onToggle,
}: {
  idPrefix: string;
  name: string;
  options: readonly (readonly [string, string])[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="interest-flow__choices interest-flow__choices--multiple">
      <legend className="sr-only">Choose all that apply</legend>
      {options.map(([optionValue, label]) => (
        <label className="interest-flow__choice" key={optionValue}>
          <input
            type="checkbox"
            name={`${idPrefix}-${name}`}
            value={optionValue}
            checked={values.includes(optionValue)}
            onChange={() => onToggle(optionValue)}
          />
          <span aria-hidden="true" />
          <strong>{label}</strong>
        </label>
      ))}
    </fieldset>
  );
}

export function WaitlistSignupFlow({
  placement,
  tone = "dark",
  compact = false,
  finishHref = "/",
  usePreorderLaunchCopy = false,
  preorderHref,
  preorderPriceLabel,
}: {
  placement: string;
  tone?: "dark" | "light";
  compact?: boolean;
  finishHref?: string;
  usePreorderLaunchCopy?: boolean;
  preorderHref?: string;
  preorderPriceLabel?: string;
}) {
  const flow = useWaitlistFlow();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewed = useRef(false);
  const reservationCtaViewed = useRef(false);
  const idPrefix = placement.replaceAll("_", "-");
  const isActivePlacement = flow.activePlacement === placement;
  const neverMeasured =
    flow.monitoringFrequency === "never_outside_appointment";
  const isFinalStep = neverMeasured
    ? flow.surveyStep === FINAL_NEVER_MEASURED_STEP
    : flow.surveyStep === FINAL_MEASURED_STEP;
  const hasConditionalObjection =
    flow.preorderDeclineReason === "price_too_high" ||
    flow.preorderDeclineReason === "need_more_evidence";
  const declineFinalStep = hasConditionalObjection ? 2 : 1;
  const isDeclineFinalStep = flow.preorderDeclineStep === declineFinalStep;

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
      !preorderHref ||
      (flow.stage !== "completed" && flow.stage !== "finished") ||
      reservationCtaViewed.current
    ) {
      return;
    }
    reservationCtaViewed.current = true;
    trackWaitlistEvent("reservation_cta_viewed", { placement });
  }, [flow.stage, placement, preorderHref]);

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
    if (isFinalStep) {
      void flow.submitSurvey(placement);
      return;
    }
    flow.continueSurvey();
  }

  const title =
    flow.surveyStep === 0
      ? "How many days in the past 30 did you measure your blood pressure outside an appointment?"
      : flow.surveyStep === 1 && neverMeasured
        ? "Before today, had you taken any steps to measure your blood pressure outside appointments?"
        : flow.surveyStep === 1
          ? "What prompted your most recent blood pressure measurement outside a medical appointment?"
          : flow.surveyStep === 2
            ? "What did you use for that blood pressure measurement?"
            : "How well did that blood pressure measurement meet your needs?";

  const canContinue =
    (flow.surveyStep === 0 && Boolean(flow.monitoringFrequency)) ||
    (flow.surveyStep === 1 &&
      Boolean(neverMeasured ? flow.monitoringReadiness : flow.monitoringReason)) ||
    (flow.surveyStep === 2 && Boolean(flow.monitoringMethod)) ||
    (flow.surveyStep === FINAL_MEASURED_STEP && Boolean(flow.monitoringOutcome));

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
                  ? "Product milestones, launch news, and opportunities to shape what comes next."
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
                  {flow.emailStatus === "submitting" ? "Getting updates…" : "Get updates"}
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
                Product and launch updates. Unsubscribe anytime.{" "}
                <a href="/privacy">Privacy</a>
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
          <div
            className="interest-flow__progress"
            aria-label={`Question ${flow.surveyStep + 1} of ${flow.surveySteps}`}
          >
            <span>{`0${flow.surveyStep + 1}`}</span>
            <div>
              <i
                style={{
                  width: `${((flow.surveyStep + 1) / flow.surveySteps) * 100}%`,
                }}
              />
            </div>
            <span>{`0${flow.surveySteps}`}</span>
          </div>
          <div className="interest-flow__content">
            <p className="eyebrow">
              {flow.surveyStep === 0
                ? `You’re on the list · Question 1 of ${flow.surveySteps}`
                : `Question ${flow.surveyStep + 1} of ${flow.surveySteps}`}
            </p>
            <h2 id={`${idPrefix}-survey-title`} ref={headingRef} tabIndex={-1}>
              {title}
            </h2>

            {flow.surveyStep === 0 ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="monitoring-frequency"
                options={MONITORING_FREQUENCY_OPTIONS}
                value={flow.monitoringFrequency}
                error={flow.errors.monitoringFrequency}
                onChange={flow.setMonitoringFrequency}
              />
            ) : null}

            {flow.surveyStep === 1 && neverMeasured ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="monitoring-readiness"
                options={MONITORING_READINESS_OPTIONS}
                value={flow.monitoringReadiness}
                error={flow.errors.monitoringReadiness}
                onChange={flow.setMonitoringReadiness}
              />
            ) : null}

            {flow.surveyStep === 1 && !neverMeasured ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="monitoring-reason"
                options={MONITORING_REASON_OPTIONS}
                value={flow.monitoringReason}
                error={flow.errors.monitoringReason}
                onChange={flow.setMonitoringReason}
              />
            ) : null}

            {flow.surveyStep === 2 ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="monitoring-method"
                options={MONITORING_METHOD_OPTIONS}
                value={flow.monitoringMethod}
                error={flow.errors.monitoringMethod}
                onChange={flow.setMonitoringMethod}
              />
            ) : null}

            {flow.surveyStep === FINAL_MEASURED_STEP ? (
              <>
                <ChoiceList
                  idPrefix={idPrefix}
                  name="monitoring-outcome"
                  options={MONITORING_OUTCOME_OPTIONS}
                  value={flow.monitoringOutcome}
                  error={flow.errors.monitoringOutcome}
                  onChange={flow.setMonitoringOutcome}
                />
                {QUALITATIVE_FOLLOW_UP_OUTCOMES.has(flow.monitoringOutcome) ? (
                  <div className="interest-flow__text-response interest-flow__text-response--optional form-field">
                    <label htmlFor={`${idPrefix}-qualitative-detail`}>
                      Thinking about that specific occasion, what was difficult or
                      still unclear?
                    </label>
                    <textarea
                      id={`${idPrefix}-qualitative-detail`}
                      name="qualitativeDetail"
                      value={flow.qualitativeDetail}
                      onChange={(event) => flow.setQualitativeDetail(event.target.value)}
                      maxLength={MAX_QUALITATIVE_DETAIL_LENGTH}
                      placeholder="A few words is enough"
                      aria-describedby={`${idPrefix}-qualitative-detail-note`}
                    />
                    <div className="field-hint" id={`${idPrefix}-qualitative-detail-note`}>
                      <span>Please don’t include private medical information.</span>
                      <span>
                        {flow.qualitativeDetail.length}/{MAX_QUALITATIVE_DETAIL_LENGTH}
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {flow.submissionError ? (
            <p className="form-error form-error--submission" role="alert">
              {flow.submissionError}
            </p>
          ) : null}
          <footer
            className={`interest-flow__actions${flow.surveyStep > 0 ? " interest-flow__actions--split" : ""}`}
          >
            {flow.surveyStep > 0 ? (
              <button
                className="button button--secondary interest-flow__back"
                type="button"
                onClick={flow.backSurvey}
                disabled={flow.surveyStatus === "submitting"}
              >
                Back
              </button>
            ) : null}
            <button
              className="button button--dark"
              type="submit"
              disabled={!canContinue || flow.surveyStatus === "submitting"}
            >
              {flow.surveyStatus === "submitting"
                ? "Submitting…"
                : isFinalStep
                  ? "Submit answers"
                  : "Continue"}
            </button>
          </footer>
        </form>
      ) : null}

      {flow.stage === "completed" ? (
        <div className="interest-flow__success" aria-live="polite">
          <div className="interest-flow__success-copy">
            <p className="eyebrow interest-flow__success-status">
              <span aria-hidden="true">✓</span>
              Answers saved
            </p>
            <h2 ref={headingRef} tabIndex={-1}>
              Thanks. Your answers have been saved.
            </h2>
            {preorderHref && preorderPriceLabel ? (
              <>
                <p>
                  Reserve Frame for {preorderPriceLabel} today to lock in your
                  $299 price - $100 less than the $399 launch price. Your
                  reservation is fully refundable and counts toward the total,
                  leaving $250 due before shipping.
                </p>
                <div className="interest-flow__success-actions interest-flow__success-actions--stacked">
                  <a
                    className="button button--dark interest-flow__preorder-button"
                    href={preorderHref}
                    onClick={() =>
                      trackWaitlistEvent("reservation_cta_clicked", { placement })
                    }
                  >
                    <span>Reserve Frame</span>
                    <span>
                      {preorderPriceLabel} <span aria-hidden="true">→</span>
                    </span>
                  </a>
                  <button
                    className="text-link interest-flow__decline-trigger"
                    type="button"
                    onClick={() => flow.beginPreorderDecline(placement)}
                  >
                    <span>I’m not ready to reserve</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  We read every response. Yours will help guide Frame’s development.
                </p>
                <div className="interest-flow__success-actions">
                  <Link className="button button--dark" href={finishHref}>
                    <span aria-hidden="true">←</span> Return to Frame
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {flow.stage === "preorder_decline" ? (
        <form
          className="interest-flow__form interest-flow__decline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (isDeclineFinalStep) {
              void flow.submitPreorderDecline(placement);
            } else {
              flow.continuePreorderDecline();
            }
          }}
          noValidate
        >
          <div className="interest-flow__content">
            <p className="eyebrow">
              Reservation research · Question {flow.preorderDeclineStep + 1} of{" "}
              {declineFinalStep + 1}
            </p>
            <h2 ref={headingRef} tabIndex={-1}>
              {flow.preorderDeclineStep === 0
                ? "What’s the main reason you wouldn’t reserve Frame today?"
                : flow.preorderDeclineStep === 1 &&
                    flow.preorderDeclineReason === "price_too_high"
                  ? "If Frame delivered reliable automatic blood-pressure tracking throughout the day, what’s the most you’d realistically consider paying for it?"
                  : flow.preorderDeclineStep === 1 &&
                      flow.preorderDeclineReason === "need_more_evidence"
                    ? "What would make you comfortable buying Frame?"
                    : "Would you be open to a short call or testing an early Frame prototype?"}
            </h2>

            {flow.preorderDeclineStep === 0 ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="preorder-decline-reason"
                options={PREORDER_DECLINE_REASON_OPTIONS}
                value={flow.preorderDeclineReason}
                onChange={flow.setPreorderDeclineReason}
              />
            ) : null}

            {flow.preorderDeclineStep === 0 &&
            flow.preorderDeclineReason === "another_reason" ? (
              <div className="interest-flow__text-response interest-flow__text-response--optional form-field">
                <label htmlFor={`${idPrefix}-preorder-decline-detail`}>Tell us more (optional)</label>
                <textarea
                  id={`${idPrefix}-preorder-decline-detail`}
                  name="preorderDeclineDetail"
                  value={flow.preorderDeclineDetail}
                  onChange={(event) =>
                    flow.setPreorderDeclineDetail(event.target.value)
                  }
                  maxLength={MAX_QUALITATIVE_DETAIL_LENGTH}
                  placeholder="A few words is enough"
                  aria-describedby={`${idPrefix}-preorder-decline-detail-note`}
                />
                <div
                  className="field-hint"
                  id={`${idPrefix}-preorder-decline-detail-note`}
                >
                  <span>Please don’t include private medical information.</span>
                  <span>
                    {flow.preorderDeclineDetail.length}/
                    {MAX_QUALITATIVE_DETAIL_LENGTH}
                  </span>
                </div>
              </div>
            ) : null}

            {flow.preorderDeclineStep === 1 &&
            flow.preorderDeclineReason === "price_too_high" ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="willingness-to-pay"
                options={WILLINGNESS_TO_PAY_OPTIONS}
                value={flow.willingnessToPayBand}
                onChange={flow.setWillingnessToPayBand}
              />
            ) : null}

            {flow.preorderDeclineStep === 1 &&
            flow.preorderDeclineReason === "need_more_evidence" ? (
              <>
                <MultiChoiceList
                  idPrefix={idPrefix}
                  name="evidence-requirements"
                  options={EVIDENCE_REQUIREMENT_OPTIONS}
                  values={flow.evidenceRequirements}
                  onToggle={flow.toggleEvidenceRequirement}
                />
                {flow.evidenceRequirements.includes("something_else") ? (
                  <div className="interest-flow__text-response interest-flow__text-response--optional form-field">
                    <label htmlFor={`${idPrefix}-evidence-requirements-other`}>
                      What other evidence would help? (optional)
                    </label>
                    <textarea
                      id={`${idPrefix}-evidence-requirements-other`}
                      value={flow.evidenceRequirementsOther}
                      onChange={(event) =>
                        flow.setEvidenceRequirementsOther(event.target.value)
                      }
                      maxLength={MAX_QUALITATIVE_DETAIL_LENGTH}
                      placeholder="A few words is enough"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {isDeclineFinalStep ? (
              <ChoiceList
                idPrefix={idPrefix}
                name="research-call"
                options={RESEARCH_CALL_OPTIONS}
                value={flow.openToResearchCall}
                onChange={flow.setOpenToResearchCall}
              />
            ) : null}
          </div>
          {flow.submissionError ? (
            <p className="form-error form-error--submission" role="alert">
              {flow.submissionError}
            </p>
          ) : null}
          <footer
            className={`interest-flow__actions${flow.preorderDeclineStep > 0 ? " interest-flow__actions--split" : ""}`}
          >
            {flow.preorderDeclineStep > 0 ? (
              <button
                className="button button--secondary interest-flow__back"
                type="button"
                onClick={flow.backPreorderDecline}
                disabled={flow.surveyStatus === "submitting"}
              >
                Back
              </button>
            ) : null}
            <button
              className="button button--dark"
              type="submit"
              disabled={
                !flow.preorderDeclineReason ||
                (flow.preorderDeclineStep === 1 &&
                  flow.preorderDeclineReason === "price_too_high" &&
                  !flow.willingnessToPayBand) ||
                (flow.preorderDeclineStep === 1 &&
                  flow.preorderDeclineReason === "need_more_evidence" &&
                  !flow.evidenceRequirements.length) ||
                (isDeclineFinalStep && !flow.openToResearchCall) ||
                flow.surveyStatus === "submitting"
              }
            >
              {flow.surveyStatus === "submitting"
                ? "Saving…"
                : isDeclineFinalStep
                  ? "Submit answers"
                  : "Continue"}
            </button>
          </footer>
        </form>
      ) : null}

      {flow.stage === "skipped" ? (
        <div className="interest-flow__success" aria-live="polite">
          <p className="eyebrow">Updates confirmed</p>
          <h2 ref={headingRef} tabIndex={-1}>
            You’re subscribed.
          </h2>
          <p>Your place on the updates list is confirmed.</p>
          <div className="interest-flow__success-actions">
            <Link className="button button--dark" href={finishHref}>
              <span aria-hidden="true">←</span> Back to Frame
            </Link>
          </div>
        </div>
      ) : null}

      {flow.stage === "finished" ? (
        <div className="interest-flow__success" aria-live="polite">
          <p className="eyebrow">Response saved</p>
          <h2 ref={headingRef} tabIndex={-1}>
            Thank you for sharing.
          </h2>
          <p>Your feedback will help us shape Frame.</p>
          <div className="interest-flow__success-actions">
            <Link
              className="text-link interest-flow__decline-trigger"
              href={finishHref}
            >
              <span>Return to Frame</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WaitlistSurveyHeaderAction({
  placement,
  finishHref = "/",
}: {
  placement: string;
  finishHref?: string;
}) {
  const flow = useWaitlistFlow();

  if (flow.stage === "survey") {
    return (
      <button
        className="site-header__back site-header__back--forward"
        type="button"
        onClick={() => flow.skipSurvey(placement)}
        disabled={flow.surveyStatus === "submitting"}
        aria-label="Skip survey"
      >
        <span className="site-header__back-label">Skip</span>
        <span className="site-header__back-arrow" aria-hidden="true">←</span>
      </button>
    );
  }

  if (flow.stage === "preorder_decline") {
    return (
      <Link
        className="site-header__back site-header__back--forward"
        href={finishHref}
        aria-label="Skip question and return to Frame"
      >
        <span className="site-header__back-label">Skip</span>
        <span className="site-header__back-arrow" aria-hidden="true">←</span>
      </Link>
    );
  }

  return (
    <Link className="site-header__back" href={finishHref}>
      <span className="site-header__back-arrow" aria-hidden="true">←</span>
      <span className="site-header__back-label">Back to Frame</span>
    </Link>
  );
}

export function WaitlistQualificationFlow({
  placement,
  finishHref = "/",
  preorderHref,
  preorderPriceLabel,
}: {
  placement: string;
  finishHref?: string;
  preorderHref?: string;
  preorderPriceLabel?: string;
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
        <p className="eyebrow">Survey link expired</p>
        <h1>Return to Frame to begin.</h1>
        <p>Join the updates list first and we’ll bring you straight to the survey.</p>
        <Link className="button button--dark" href="/#homepage-hero-waitlist">
          Join the updates list
        </Link>
      </div>
    );
  }

  return (
    <WaitlistSignupFlow
      placement={placement}
      finishHref={finishHref}
      preorderHref={preorderHref}
      preorderPriceLabel={preorderPriceLabel}
    />
  );
}
