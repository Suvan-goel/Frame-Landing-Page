"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function ContributorAuthConfirm() {
  const [message, setMessage] = useState("Securing your member session…");

  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseBrowserClient();
    if (!client) {
      const timer = window.setTimeout(() => {
        setMessage("Member sign-in is not configured in this environment.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    async function finish() {
      const { data, error } = await client!.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        setMessage("This sign-in link is invalid or has expired. Request a new one.");
        return;
      }
      window.location.replace("/contributors");
    }
    void finish();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="contributor-auth-page">
      <section className="contributor-auth-card contributor-auth-card--centered">
        <p className="eyebrow">Founding Contributor</p>
        <h1>Signing you in</h1>
        <p role="status">{message}</p>
      </section>
    </main>
  );
}
