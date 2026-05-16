"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setMessageType("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (!response.ok) {
      setMessageType("error");
      setMessage("Failed to change password. Please try again.");
      setSubmitting(false);
      return;
    }

    setMessageType("success");
    setMessage("Password changed successfully. Redirecting…");
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 1200);
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <LabIcon />
        <p className="eyebrow" style={{ marginTop: 20 }}>First-time login</p>
        <h1 style={{ marginTop: 10 }}>Set your personal password</h1>
        <p className="auth-visual-desc">
          For your security, you must change the temporary password before
          accessing the laboratory logbook system.
        </p>
        <div className="auth-features" style={{ marginTop: 28 }}>
          <div className="auth-feature">
            <p className="auth-feature-label">Minimum length</p>
            <p className="auth-feature-value">8 characters</p>
          </div>
          <div className="auth-feature">
            <p className="auth-feature-label">Tip</p>
            <p className="auth-feature-value">Use a unique phrase</p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="access-badge">
            Temporary password active
          </div>

          <h2>Set new password</h2>
          <p className="auth-subtitle">
            Your temporary password requires a one-time reset before you can continue.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat the password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {message && (
              <p className={`notice notice-${messageType}`} style={{ margin: 0 }}>{message}</p>
            )}

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 4 }}
            >
              {submitting ? "Saving…" : "Set new password & continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}

function LabIcon() {
  return (
    <div className="lab-logo" style={{ width: 52, height: 52 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6m-3 0v6l4 8a2 2 0 01-1.8 3H9.8a2 2 0 01-1.8-3l4-8V3" />
        <path d="M6 17h12" />
      </svg>
    </div>
  );
}
