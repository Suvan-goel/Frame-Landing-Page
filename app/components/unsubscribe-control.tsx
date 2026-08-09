"use client";

import { useState } from "react";

export function UnsubscribeControl({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function unsubscribe() {
    if (!token) {
      setStatus("error");
      setMessage("This unsubscribe link is invalid.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch(
        `/api/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Your preference could not be updated.");
      }
      setStatus("done");
      setMessage("You’ve been unsubscribed from Frame development updates.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Your preference could not be updated.",
      );
    }
  }

  if (status === "done") {
    return <p className="unsubscribe-result unsubscribe-result--success">{message}</p>;
  }

  return (
    <div className="unsubscribe-control">
      <button
        className="button button--dark"
        type="button"
        onClick={unsubscribe}
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Updating…" : "Unsubscribe"}
      </button>
      {message ? (
        <p className="unsubscribe-result" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
