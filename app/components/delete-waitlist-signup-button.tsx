"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteWaitlistSignupButton({
  signupId,
  leadLabel,
}: {
  signupId: number;
  leadLabel: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteSignup() {
    const confirmed = window.confirm(
      `Permanently delete ${leadLabel}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/waitlist/${signupId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "The signup could not be deleted.");
      }
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The signup could not be deleted.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="admin-delete">
      <button type="button" onClick={deleteSignup} disabled={isDeleting}>
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
