"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getContributorAccessToken } from "@/lib/supabase-browser";

const areas = [
  ["comfort", "Comfort and everyday wear"],
  ["industrial_design", "Industrial design"],
  ["app_experience", "App experience"],
  ["development_updates", "Development updates"],
  ["health_communication", "Clear health communication"],
] as const;

export function ContributorOnboarding() {
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    const accessToken = isPreview ? null : await getContributorAccessToken();
    if (!isPreview && !accessToken) {
      window.location.replace("/contributors/sign-in");
      return;
    }

    const payload = {
      preferredName: form.get("preferredName"),
      country: form.get("country"),
      interestReason: form.get("interestReason"),
      learningGoal: form.get("learningGoal"),
      purchaseUnderstanding: form.get("purchaseUnderstanding"),
      usesHealthWearable:
        form.get("usesHealthWearable") === "yes"
          ? true
          : form.get("usesHealthWearable") === "no"
            ? false
            : null,
      productAreas: form.getAll("productAreas"),
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
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      window.location.replace(isPreview ? "/contributors?preview=1" : "/contributors");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save your profile.");
      setSaving(false);
    }
  }

  return (
    <main className="contributor-onboarding-page">
      <section className="contributor-onboarding-intro">
        <p className="eyebrow">Member onboarding</p>
        <h1>Help us make your contributor year useful.</h1>
        <p>These questions shape how Frame communicates and where contributor input is invited. Please do not share diagnoses, symptoms, test results, or other medical information.</p>
      </section>
      <form className="contributor-onboarding-form" onSubmit={submit}>
        <fieldset>
          <legend>About you</legend>
          <label>Preferred name<input name="preferredName" autoComplete="given-name" maxLength={60} required /></label>
          <label>Country of residence<input name="country" autoComplete="country-name" maxLength={80} required /></label>
          <label>What made you interested in Frame?<textarea name="interestReason" rows={5} minLength={20} maxLength={750} required /></label>
          <label>What would make your contributor year valuable?<textarea name="learningGoal" rows={5} minLength={20} maxLength={750} required /></label>
        </fieldset>

        <fieldset>
          <legend>Where you would like to contribute</legend>
          <div className="contributor-check-grid">
            {areas.map(([id, label]) => <label key={id}><input type="checkbox" name="productAreas" value={id} /><span>{label}</span></label>)}
          </div>
          <label>Do you currently use a health wearable?
            <select name="usesHealthWearable" defaultValue="">
              <option value="">Prefer not to say</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Confirm what you purchased</legend>
          <div className="contributor-onboarding-note"><strong>Frame is not selling a device.</strong><p>Your payment is for 12 months of Founding Contributor membership. Frame is in development; outcomes, timelines, a future product, regulatory approval, and a future discount are not guaranteed.</p></div>
          <label>In your own words, what does your Founding Contributor payment provide?<textarea name="purchaseUnderstanding" rows={5} minLength={20} maxLength={750} required /></label>
          <label className="contributor-checkbox-line"><input type="checkbox" name="foundersWallOptIn" value="yes" /><span>You may list my preferred name on a future digital Founders Wall. I can withdraw this permission later.</span></label>
        </fieldset>

        {status ? <p className="contributor-form-message" role="alert">{status}</p> : null}
        <div className="contributor-onboarding-actions">
          <Link href="/contributors">Complete later</Link>
          <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Complete onboarding"}</button>
        </div>
      </form>
    </main>
  );
}

