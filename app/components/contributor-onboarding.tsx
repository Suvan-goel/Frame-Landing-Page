"use client";

import { FormEvent, useState } from "react";
import type { ContributorProfile } from "@/lib/contributor-types";
import { getContributorAccessToken } from "@/lib/supabase-browser";

const areas = [
  ["comfort", "Comfort and everyday wear"],
  ["industrial_design", "Industrial design"],
  ["app_experience", "App experience"],
  ["development_updates", "Development updates"],
  ["health_communication", "Clear health communication"],
] as const;

type ContributorProfileFormProps = {
  profile: ContributorProfile;
  fullName: string;
  onSaved: (profile: ContributorProfile, completedAt: string) => void;
};

export function ContributorProfileForm({
  profile,
  fullName,
  onSaved,
}: ContributorProfileFormProps) {
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setStatus("");

    const form = new FormData(event.currentTarget);
    const productAreas = form.getAll("productAreas");
    if (productAreas.length === 0) {
      setStatus("Choose at least one area where you would like to contribute.");
      setSaving(false);
      return;
    }

    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    const accessToken = isPreview ? null : await getContributorAccessToken();
    if (!isPreview && !accessToken) {
      window.location.replace("/contributors/sign-in?next=profile");
      return;
    }

    const payload = {
      preferredName: form.get("preferredName"),
      country: form.get("country"),
      learningGoal: form.get("learningGoal"),
      productAreas,
      foundersWallOptIn: form.get("foundersWallOptIn") === "yes",
    };

    try {
      const response = await fetch("/api/contributors/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        profile?: ContributorProfile;
        onboardingCompletedAt?: string;
      };
      if (!response.ok || !result.profile || !result.onboardingCompletedAt) {
        throw new Error(result.error || "Could not save your profile.");
      }
      onSaved(result.profile, result.onboardingCompletedAt);
      setStatus("Your contributor profile has been saved.");
      setSaved(true);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const suggestedName = profile.preferredName || fullName.split(/\s+/)[0] || "";

  return (
    <form className="contributor-onboarding-form hub-profile-form" onSubmit={submit}>
      <fieldset>
        <legend>About you</legend>
        <label>
          Preferred name
          <input
            name="preferredName"
            autoComplete="given-name"
            defaultValue={suggestedName}
            maxLength={60}
            required
          />
        </label>
        <label>
          Country of residence
          <input
            name="country"
            autoComplete="country-name"
            defaultValue={profile.country}
            maxLength={80}
            required
          />
        </label>
        <label>
          <span className="hub-profile-form__field-label">
            What would make your contributor year valuable? <small>(optional)</small>
          </span>
          <textarea
            name="learningGoal"
            rows={4}
            defaultValue={profile.learningGoal}
            maxLength={750}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Where you would like to contribute</legend>
        <p className="hub-profile-form__help" id="product-areas-help">
          Choose at least one. You can update these preferences at any time.
        </p>
        <div className="contributor-check-grid" aria-describedby="product-areas-help">
          {areas.map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                name="productAreas"
                value={id}
                defaultChecked={profile.productAreas.includes(id)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Profile visibility</legend>
        <label className="contributor-checkbox-line">
          <input
            type="checkbox"
            name="foundersWallOptIn"
            value="yes"
            defaultChecked={profile.foundersWallOptIn}
          />
          <span>
            You may list my preferred name on a future digital Founders Wall. I can
            change this permission here at any time.
          </span>
        </label>
      </fieldset>

      <p className="hub-profile-form__privacy">
        Please do not include diagnoses, symptoms, test results, or other medical
        information in your profile.
      </p>
      {status ? (
        <p
          className={`contributor-form-message${saved ? " is-success" : ""}`}
          role={saved ? "status" : "alert"}
        >
          {status}
        </p>
      ) : null}
      <div className="contributor-onboarding-actions">
        <span>Your changes stay available whenever you return to the hub.</span>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
