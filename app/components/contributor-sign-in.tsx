"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function subscribeToLocation() {
  return () => {};
}

function isLocalBrowser() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function ContributorSignIn() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const isLocal = useSyncExternalStore(subscribeToLocation, isLocalBrowser, () => false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSending(true);
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Member sign-in is not configured in this environment yet.");
      setSending(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    const redirectUrl = new URL("/contributors/auth/confirm", window.location.origin);
    if (next === "profile") redirectUrl.searchParams.set("next", "profile");
    const result = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl.toString(), shouldCreateUser: false },
    });
    setMessage(
      result.error
        ? "We could not send that sign-in link. Check that you used your membership email."
        : next === "profile"
          ? "Check your inbox for a secure sign-in link. It will return you to your profile in the contributor hub."
          : "Check your inbox for a secure sign-in link. It will return you to the contributor hub.",
    );
    setSending(false);
  }

  return (
    <main className="contributor-auth-page">
      <section className="contributor-auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">Private member area</p>
        <h1 id="sign-in-title">Sign in to the contributor hub</h1>
        <p>
          Use the email address from your Founding Contributor purchase. We will email you a
          one-time secure link. There is no password to remember.
        </p>
        <form onSubmit={submit} className="contributor-auth-form">
          <label htmlFor="contributor-email">Membership email</label>
          <input
            id="contributor-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="button button--primary" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
        {message ? <p className="contributor-form-message" role="status">{message}</p> : null}
        {isLocal ? (
          <div className="contributor-preview-callout">
            <strong>Local testing</strong>
            <p>Open the complete hub with sample member data and no account.</p>
            <Link className="text-link" href="/contributors?preview=1">Open local member preview</Link>
          </div>
        ) : null}
        <p className="contributor-auth-help">
          Not a member? <Link href="/founding-contributors">View membership details</Link>.
        </p>
      </section>
    </main>
  );
}
