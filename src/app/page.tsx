"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppUser, InstrumentCategory, InstrumentTemplate } from "@/lib/logbook";
import { UserAvatar } from "@/components/UserAvatar";
import { SignaturePad } from "@/components/SignaturePad";
import { encodeAnalystSignature } from "@/lib/signature";

type SubmitState = "idle" | "submitting" | "sent" | "error";

const emptyRecord = {
  date: new Date().toISOString().slice(0, 10),
  analyst: "",
  analystSignature: "",
  sampleId: "",
  startTime: "",
  endTime: "",
  methodUsed: "",
  remarks: "",
};

const CAT_ACTIVE_CLASS: Record<string, string> = { ICP: "active-icp", HPLC: "active-hplc", GC: "active-gc" };

function computeDuration(start: string, end: string): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default function AnalystEntryPage() {
  const [categories, setCategories]         = useState<InstrumentCategory[]>([]);
  const [templates, setTemplates]           = useState<InstrumentTemplate[]>([]);
  const [selectedCatId, setSelectedCatId]   = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<InstrumentTemplate | null>(null);
  const [record, setRecord]                 = useState(emptyRecord);
  const [submitState, setSubmitState]       = useState<SubmitState>("idle");
  const [message, setMessage]               = useState("");
  const [user, setUser]                     = useState<AppUser | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [signatureImage, setSignatureImage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setRecord((prev) => ({ ...prev, analyst: d.user.fullName, analystSignature: d.user.fullName }));
        }
      })
      .catch(() => {});

    Promise.all([
      fetch("/api/templates/categories").then((r) => (r.ok ? r.json() : { categories: [] })),
      fetch("/api/templates").then((r) => (r.ok ? r.json() : { templates: [] })),
    ])
      .then(([catData, tplData]) => {
        const cats: InstrumentCategory[] = catData.categories ?? [];
        const tpls: InstrumentTemplate[] = tplData.templates ?? [];
        setCategories(cats);
        setTemplates(tpls);
        if (cats.length > 0) setSelectedCatId(cats[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  const selectedCatName  = categories.find((c) => c.id === selectedCatId)?.name ?? "";
  const visibleTemplates = useMemo(() => templates.filter((t) => t.categoryId === selectedCatId), [templates, selectedCatId]);
  const duration         = computeDuration(record.startTime, record.endTime);
  const canAccessAdmin   = user?.role === "admin" || user?.role === "supervisor";

  function updateField(name: string, value: string) { setRecord((prev) => ({ ...prev, [name]: value })); }
  function selectCategory(id: string) { setSelectedCatId(id); setSelectedTemplate(null); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); }

  const signatureReady = Boolean(signatureImage || record.analystSignature);
  const requiredFilled = [selectedTemplate, record.date, record.analyst, record.sampleId, record.startTime, record.endTime, record.methodUsed, signatureReady];
  const completion = Math.round((requiredFilled.filter(Boolean).length / requiredFilled.length) * 100);
  const canSubmit = user && requiredFilled.every(Boolean);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate || !user) return;
    setSubmitState("submitting");
    setMessage("");

    const payload = {
      laboratoryName:   selectedTemplate.laboratoryName,
      department:       selectedTemplate.department,
      location:         selectedTemplate.location,
      instrumentName:   selectedTemplate.instrumentName,
      instrumentModel:  selectedTemplate.instrumentModel,
      serialNumber:     selectedTemplate.serialNumber,
      manufacturer:     selectedTemplate.manufacturer,
      installationDate: selectedTemplate.installationDate,
      instrumentId:     selectedTemplate.instrumentId,
      methodUsed:       record.methodUsed,
      date:             record.date,
      analyst:          record.analyst,
      sampleId:         record.sampleId,
      startTime:        record.startTime,
      endTime:          record.endTime,
      remarks:          record.remarks,
      analystSignature: encodeAnalystSignature({
        typed: record.analystSignature,
        image: signatureImage,
        signedAt: new Date().toISOString(),
        signedBy: user.fullName,
        username: user.username,
      }),
    };

    const response = await fetch("/api/logbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setSubmitState("error");
      setMessage(response.status === 401 ? "Sign in before submitting." : "Submission failed. Please try again.");
      return;
    }

    const result = await response.json();
    setSubmitState("sent");
    setMessage(result.telegramSent ? "Record submitted. Supervisor notified via Telegram." : "Record submitted. Awaiting supervisor review.");
    setRecord((prev) => ({ ...emptyRecord, date: new Date().toISOString().slice(0, 10), analyst: prev.analyst, analystSignature: prev.analystSignature, methodUsed: "" }));
    setSignatureImage("");
    setSelectedTemplate(null);
  }

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Primary navigation">
        <div className="rail-brand">
          <LabIcon />
          <span>Lab Logbook</span>
        </div>
        <nav className="rail-nav">
          <Link className="rail-link active" href="/">
            <RailEntryIcon />
            <span>Entry</span>
          </Link>
          <Link className="rail-link" href={canAccessAdmin ? "/admin" : "/login?redirect=/admin"}>
            <RailReviewIcon />
            <span>{canAccessAdmin ? "Admin" : "Review"}</span>
          </Link>
          {user && (
            <Link className="rail-link" href="/settings">
              <RailSettingsIcon />
              <span>Settings</span>
            </Link>
          )}
          {user && (
            <Link className="rail-avatar" href="/settings" title={user.fullName}>
              <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" />
              <span>{user.username}</span>
            </Link>
          )}
        </nav>
        <div className="rail-foot">
          <span className="rail-caption">Daily use records</span>
        </div>
      </aside>

      <div className="app-frame entry-frame">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="brand-heading">
          <LabIcon />
          <div className="brand-text">
            <p className="eyebrow">Analytical Instruments</p>
            <h1>Daily Instrument Use Record</h1>
          </div>
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-chip">
                <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" />
                {user.fullName} &middot; <span style={{ textTransform: "capitalize" }}>{user.role}</span>
              </span>
              <div className="topbar-nav-btns">
                <Link className="btn btn-outline btn-sm" href="/settings">Settings</Link>
                <button className="btn btn-outline btn-sm" type="button" onClick={logout}>Sign out</button>
                <Link className="btn btn-primary btn-sm" href={canAccessAdmin ? "/admin" : "/login?redirect=/admin"}>
                  {canAccessAdmin ? "Admin Dashboard" : "Supervisor Login"}
                </Link>
              </div>
            </>
          ) : (
            <div className="topbar-nav-btns">
              <Link className="btn btn-outline btn-sm" href="/login">Sign in</Link>
              <Link className="btn btn-primary btn-sm" href="/login?redirect=/admin">Supervisor Login</Link>
            </div>
          )}
        </div>
      </header>

      {/* ── Status strip ── */}
      <div className="lab-status-strip">
        <div className="status-strip-cell">
          <span className="label">Session</span>
          <strong>{user ? `${user.username} — Authenticated` : "Not signed in"}</strong>
        </div>
        <div className="status-strip-cell">
          <span className="label">Instrument</span>
          <strong>{selectedTemplate ? selectedTemplate.instrumentName : "None selected"}</strong>
        </div>
        <div className="status-strip-cell">
          <span className="label">Today</span>
          <strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>
        </div>
        <div className="status-strip-cell">
          <span className="label">Record Status</span>
          <strong style={{ color: submitState === "sent" ? "var(--success)" : undefined }}>
            {submitState === "sent" ? "Submitted ✓" : user ? "Ready to submit" : "Login required"}
          </strong>
        </div>
      </div>

      <form className="workspace entry-layout" onSubmit={handleSubmit}>
        <div className="form-stack">

          {/* ── Panel 1: Instrument selector ── */}
          <section className="panel">
            <div className="section-heading">
              <span className="section-number">1</span>
              <div className="section-heading-text">
                <h2>Select Instrument</h2>
                <p>Choose a category and instrument — all lab details auto-fill from the template.</p>
              </div>
            </div>

            {loadingTemplates ? (
              <div className="instrument-grid">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
              </div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><InstrumentIcon name="ICP" /></div>
                <p>No instrument templates configured.<br />
                  <Link href="/admin" className="text-link">Open Supervisor Dashboard</Link> to set them up.
                </p>
              </div>
            ) : (
              <>
                <div className="category-tabs">
                  {categories.map((cat) => {
                    const count = templates.filter((t) => t.categoryId === cat.id).length;
                    const activeClass = selectedCatId === cat.id ? (CAT_ACTIVE_CLASS[cat.name] ?? "active-icp") : "";
                    return (
                      <button key={cat.id} type="button" className={`category-tab ${activeClass}`} onClick={() => selectCategory(cat.id)}>
                        <CatIcon name={cat.name} />
                        {cat.name}
                        <span className="cat-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="instrument-grid">
                  {visibleTemplates.map((tpl) => (
                    <button key={tpl.id} type="button" data-cat={selectedCatName}
                      className={`instrument-card ${selectedTemplate?.id === tpl.id ? "selected" : ""}`}
                      onClick={() => setSelectedTemplate(tpl)}
                    >
                      <div className="instrument-card-accent" />
                      <div className="instrument-card-body">
                        <div className="instrument-card-icon"><InstrumentIcon name={tpl.instrumentName} /></div>
                        <p className="instrument-card-name">{tpl.instrumentName}</p>
                        <p className="instrument-card-model">{tpl.instrumentModel || tpl.manufacturer}</p>
                        <p className="instrument-card-id">{tpl.instrumentId}</p>
                      </div>
                      {selectedTemplate?.id === tpl.id && <span className="instrument-card-check">✓</span>}
                    </button>
                  ))}
                  {visibleTemplates.length === 0 && (
                    <p className="empty-state" style={{ gridColumn: "1/-1", padding: "28px 0" }}>
                      No instruments in this category. Contact your administrator.
                    </p>
                  )}
                </div>

                {selectedTemplate && (
                  <div className="instrument-banner" data-cat={selectedCatName}>
                    <div className="instrument-banner-header">
                      <div>
                        <p className="instrument-banner-title">{selectedTemplate.instrumentName}</p>
                        <p className="instrument-banner-sub">{selectedTemplate.instrumentModel} &nbsp;·&nbsp; {selectedTemplate.manufacturer}</p>
                      </div>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelectedTemplate(null)}>Change</button>
                    </div>
                    <div className="instrument-banner-grid">
                      <BannerCell label="Instrument ID" value={selectedTemplate.instrumentId} />
                      <BannerCell label="Serial No."    value={selectedTemplate.serialNumber} />
                      <BannerCell label="Laboratory"    value={selectedTemplate.laboratoryName} />
                      <BannerCell label="Department"    value={selectedTemplate.department} />
                      <BannerCell label="Location"      value={selectedTemplate.location} />
                      <BannerCell label="Method"        value={selectedTemplate.methodUsed} />
                      <BannerCell label="Installation"  value={selectedTemplate.installationDate} />
                      <BannerCell label="Manufacturer"  value={selectedTemplate.manufacturer} />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Panel 2: Daily Record ── */}
          <section className="panel">
            <div className="section-heading">
              <span className="section-number">2</span>
              <div className="section-heading-text">
                <h2>Session Record</h2>
                <p>Fill in the session details below and submit for supervisor review.</p>
              </div>
            </div>

            {/* Auth gate */}
            {!user && (
              <div className="form-auth-gate">
                <div>
                  <p style={{ fontWeight: 700 }}>Sign in required</p>
                  <p style={{ fontSize: 15, marginTop: 3, opacity: .8 }}>You must be logged in to submit records.</p>
                </div>
                <Link className="btn btn-primary btn-sm" href="/login">Sign in →</Link>
              </div>
            )}

            {/* A — Run Info */}
            <div className="form-section">
              <p className="form-section-label">Run Information</p>
              <div className="form-grid-2">
                <div className="field">
                  <label className="field-label">Date <span className="req">*</span></label>
                  <input type="date" value={record.date} onChange={(e) => updateField("date", e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Analyst <span className="req">*</span></label>
                  <input type="text" value={record.analyst} onChange={(e) => updateField("analyst", e.target.value)} placeholder="Full name" required />
                </div>
              </div>
            </div>

            {/* B — Sample */}
            <div className="form-section form-section-top-border">
              <p className="form-section-label">Sample Identification</p>
              <div className="field">
                <label className="field-label">Sample ID <span className="req">*</span></label>
                <input
                  type="text"
                  className="input-prominent"
                  value={record.sampleId}
                  onChange={(e) => updateField("sampleId", e.target.value)}
                  placeholder="e.g. S2025-001"
                  required
                />
              </div>
            </div>

            {/* C — Time */}
            <div className="form-section form-section-top-border">
              <p className="form-section-label">Time Tracking</p>
              <div className="time-row">
                <div className="field">
                  <label className="field-label">Start Time <span className="req">*</span></label>
                  <input type="time" value={record.startTime} onChange={(e) => updateField("startTime", e.target.value)} required />
                </div>
                <div className="time-arrow">→</div>
                <div className="field">
                  <label className="field-label">End Time <span className="req">*</span></label>
                  <input type="time" value={record.endTime} onChange={(e) => updateField("endTime", e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Duration</label>
                  <div className="duration-chip">{duration}</div>
                </div>
              </div>
            </div>

            {/* D — Method */}
            <div className="form-section form-section-top-border">
              <p className="form-section-label">Method</p>
              <div className="field">
                <label className="field-label">Method Used <span className="req">*</span></label>
                <input
                  type="text"
                  value={record.methodUsed}
                  onChange={(e) => updateField("methodUsed", e.target.value)}
                  placeholder="e.g. Elemental analysis by ICP-OES"
                  required
                />
              </div>
            </div>

            {/* E — Remarks & Signature */}
            <div className="form-section form-section-top-border">
              <p className="form-section-label">Observations & Sign-off</p>
              <div className="field">
                <label className="field-label">Remarks</label>
                <textarea
                  value={record.remarks}
                  onChange={(e) => updateField("remarks", e.target.value)}
                  rows={4}
                  placeholder="Instrument condition, deviations, calibration notes, observations…"
                />
              </div>
              <div className="signature-block">
                <label className="field-label">Analyst Signature <span className="req">*</span></label>
                <SignaturePad value={signatureImage} onChange={setSignatureImage} />
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label className="field-label">Typed Name / Initials Fallback</label>
                <input
                  type="text"
                  value={record.analystSignature}
                  onChange={(e) => updateField("analystSignature", e.target.value)}
                  placeholder="Initials or full name"
                />
              </div>
            </div>
          </section>

          {/* ── Submit strip ── */}
          <div className="submit-strip">
            <div className="submit-strip-status">
              <strong style={{
                color: submitState === "sent" ? "var(--success)" : submitState === "error" ? "var(--danger)" : undefined,
              }}>
                {submitState === "sent" ? "✓ Submitted successfully" : submitState === "error" ? "Submission error" : "Ready to submit"}
              </strong>
              <p>{message || (user ? "Complete all required fields, then submit for supervisor review." : "Sign in to submit records.")}</p>
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={!canSubmit || submitState === "submitting"}>
              {submitState === "submitting" ? "Submitting…" : "Submit Record"}
            </button>
          </div>
        </div>

        {/* ── Side panel ── */}
        <aside className="side-panel">
          <div className="side-card">
            <div className="side-card-header">
              <span className="side-card-title">Entry Readiness</span>
              <span className="progress-ring">{completion}%</span>
            </div>
            <div className="side-card-body">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${completion}%` }} />
              </div>
              <p style={{ fontSize: 15, color: "var(--muted)" }}>
                {canSubmit ? "All required fields complete." : "Fill required fields to submit."}
              </p>
            </div>
          </div>

          <div className="side-card">
            <div className="side-card-header">
              <span className="side-card-title">Submission Preview</span>
            </div>
            <div className="side-card-body">
              <div className="summary-list">
                <SummaryItem label="Instrument"    value={selectedTemplate?.instrumentName} />
                <SummaryItem label="Instrument ID" value={selectedTemplate?.instrumentId} />
                <SummaryItem label="Sample ID"     value={record.sampleId} />
                <SummaryItem label="Method"        value={record.methodUsed} />
                <SummaryItem label="Analyst"       value={record.analyst} />
                <SummaryItem label="Signature"     value={signatureImage ? "Drawn signature captured" : record.analystSignature} />
                <SummaryItem label="Run time"      value={record.startTime && record.endTime ? `${record.startTime} – ${record.endTime} (${duration})` : ""} />
                <SummaryItem label="Date"          value={record.date} />
              </div>
            </div>
          </div>

          {selectedTemplate && (
            <div className="side-card">
              <div className="side-card-header">
                <span className="side-card-title">Instrument Spec</span>
              </div>
              <div className="side-card-body">
                <div className="summary-list">
                  <SummaryItem label="Manufacturer" value={selectedTemplate.manufacturer} />
                  <SummaryItem label="Model"         value={selectedTemplate.instrumentModel} />
                  <SummaryItem label="Serial No."    value={selectedTemplate.serialNumber} />
                  <SummaryItem label="Location"      value={selectedTemplate.location} />
                </div>
              </div>
            </div>
          )}
        </aside>
      </form>
      </div>
    </main>
  );
}

/* ── Small components ── */

function LabIcon() {
  return (
    <div className="lab-logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6m-3 0v6l4 8a2 2 0 01-1.8 3H9.8a2 2 0 01-1.8-3l4-8V3" /><path d="M6 17h12" />
      </svg>
    </div>
  );
}

function CatIcon({ name }: { name: string }) {
  if (name === "ICP") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
  if (name === "HPLC") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
  if (name === "GC") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0110 0c0 4-5 7-5 7z" />
    </svg>
  );
  return null;
}

function InstrumentIcon({ name }: { name: string }) {
  if (name === "AAS" || name.includes("ICP")) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" opacity=".4" /><circle cx="12" cy="12" r="11" opacity=".15" />
    </svg>
  );
  if (name.includes("HPLC") || name.includes("LC") || name.includes("Ultimate")) return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2" /><path d="M8 8V6a4 4 0 018 0v2" /><path d="M12 13v3" />
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12M12 12C12 12 8 9.5 8 6a4 4 0 018 0c0 3.5-4 6-4 6z" /><path d="M9 22h6" />
    </svg>
  );
}

function RailEntryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function RailReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function RailSettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BannerCell({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="instrument-banner-cell">
      <p className="instrument-banner-cell-label">{label}</p>
      {value ? <p className="instrument-banner-cell-value">{value}</p> : <p className="instrument-banner-cell-empty">Not set</p>}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="summary-item">
      <p className="summary-label">{label}</p>
      {value ? <p className="summary-value">{value}</p> : <p className="summary-empty">Pending</p>}
    </div>
  );
}
