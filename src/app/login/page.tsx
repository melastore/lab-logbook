"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdminLogin = redirectTo.startsWith("/admin");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setMessage("Invalid username or password. Contact your administrator.");
      setSubmitting(false);
      return;
    }

    const result = await response.json();

    if (result.passwordChangeRequired) {
      // Pass redirect so after password change we land in the right place
      router.push(`/change-password?redirect=${encodeURIComponent(redirectTo)}`);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <main className="auth-shell">
      {/* ── Left visual ── */}
      <section className="auth-visual">
        <LabIcon />
        <p className="eyebrow" style={{ marginTop: 20 }}>Analytical Instruments Laboratory</p>
        <h1 style={{ marginTop: 10 }}>
          {isAdminLogin
            ? "Supervisor Dashboard\nLogin"
            : "Instrument logbook,\nreviewed without paper."}
        </h1>
        <p className="auth-visual-desc">
          {isAdminLogin
            ? "Sign in with a supervisor or admin account to access the dashboard, review logbook entries, manage instrument templates, and provision users."
            : "Secure digital record-keeping for GC, HPLC, and ICP instruments. Every entry is routed to a supervisor for review and sign-off."}
        </p>

        <div className="auth-features">
          {isAdminLogin ? (
            <>
              <div className="auth-feature">
                <p className="auth-feature-label">Admin usernames</p>
                <p className="auth-feature-value">admin01 – admin03</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">Capabilities</p>
                <p className="auth-feature-value">Review · Templates · Users</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">First login</p>
                <p className="auth-feature-value">Change temp. password</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">Analyst entry</p>
                <p className="auth-feature-value"><Link className="text-link" href="/">Go to logbook form</Link></p>
              </div>
            </>
          ) : (
            <>
              <div className="auth-feature">
                <p className="auth-feature-label">Instruments</p>
                <p className="auth-feature-value">GC · HPLC · ICP</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">Review path</p>
                <p className="auth-feature-value">Supervisor approval</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">Notifications</p>
                <p className="auth-feature-value">Telegram alerts</p>
              </div>
              <div className="auth-feature">
                <p className="auth-feature-label">Access</p>
                <p className="auth-feature-value">Role-based (3 tiers)</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Right form ── */}
      <section className="auth-panel">
        <div className="auth-card">
          <div className="login-mode-switch" aria-label="Login type">
            <Link className={`login-mode-option ${!isAdminLogin ? "active" : ""}`} href="/login">
              <span className="login-mode-icon"><UserIcon /></span>
              <span>
                <strong>Analyst</strong>
                <small>Daily entries</small>
              </span>
            </Link>
            <Link className={`login-mode-option ${isAdminLogin ? "active" : ""}`} href="/login?redirect=/admin">
              <span className="login-mode-icon"><ShieldIcon /></span>
              <span>
                <strong>Admin</strong>
                <small>Review and setup</small>
              </span>
            </Link>
          </div>

          {isAdminLogin && (
            <div className="access-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Supervisor / Admin Access
            </div>
          )}

          <h2>{isAdminLogin ? "Supervisor Sign in" : "Sign in"}</h2>
          <p className="auth-subtitle">
            {isAdminLogin
              ? "Use your admin01–admin03 credentials to access the dashboard."
              : "Enter your username and password to access the logbook."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder={isAdminLogin ? "e.g. admin01" : "e.g. analyst01"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {message && (
              <p className="notice notice-error" style={{ margin: 0 }}>{message}</p>
            )}

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 4 }}
            >
              {submitting ? "Signing in…" : isAdminLogin ? "Access Dashboard" : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {isAdminLogin ? (
              <p className="form-footer">
                Analyst?{" "}
                <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  Go to analyst login
                </Link>
              </p>
            ) : (
              <p className="form-footer">
                Supervisor?{" "}
                <Link href="/login?redirect=/admin" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  Supervisor / Admin login
                </Link>
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
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

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
