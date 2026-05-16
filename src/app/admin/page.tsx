"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AppUser, InstrumentCategory, InstrumentTemplate, LogbookRecord, LogbookStatus, ProfilePublic } from "@/lib/logbook";
import { GENERATED_USER_ACCOUNTS, type GeneratedUserAccount } from "@/lib/generated-users";
import { UserAvatar } from "@/components/UserAvatar";
import { parseAnalystSignature, signatureSummary, type AnalystSignaturePayload } from "@/lib/signature";

type Tab = "records" | "instruments" | "users";
type FilterStatus = "All" | LogbookStatus;

function formatRunTime(start: string, end: string) {
  if (!start && !end) return "";
  if (!start || !end) return start || end;
  return `${start}-${end}`;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("records");
  const [user, setUser] = useState<AppUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAuthMessage("Signed out.");
  }

  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const visibleTabs = useMemo<Tab[]>(() => (
    isAdmin ? ["records", "instruments", "users"] : ["records"]
  ), [isAdmin]);
  const activeTab = visibleTabs.includes(tab) ? tab : "records";

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Primary navigation">
        <div className="rail-brand">
          <LabLogo />
          <span>Lab Admin</span>
        </div>
        <nav className="rail-nav">
          <Link className="rail-link" href="/">
            <RailEntryIcon />
            <span>Entry</span>
          </Link>
          <Link className="rail-link active" href="/admin">
            <RailReviewIcon />
            <span>{isAdmin ? "Admin" : "Logs"}</span>
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
          <span className="rail-caption">Supervisor tools</span>
        </div>
      </aside>

      <div className="app-frame">
      <header className="topbar">
        <div className="brand-heading">
          <LabLogo />
          <div className="brand-text">
            <p className="eyebrow">Supervisor Dashboard</p>
            <h1>Instrument Logbook Management</h1>
          </div>
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-chip">
                <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" />
                {user.fullName} · <span style={{ textTransform: "capitalize" }}>{user.role}</span>
              </span>
              <div className="topbar-nav-btns">
                <Link className="btn btn-outline btn-sm" href="/settings">Settings</Link>
                <button className="btn btn-outline btn-sm" type="button" onClick={logout}>Sign out</button>
                <Link className="btn btn-outline btn-sm" href="/">Analyst Entry</Link>
              </div>
            </>
          ) : (
            <Link className="btn btn-primary btn-sm" href="/login?redirect=/admin">Sign in to Dashboard</Link>
          )}
        </div>
      </header>

      {authMessage && <div className="notice notice-info">{authMessage}</div>}
      {user?.role === "analyst" && (
        <div className="notice notice-info">All signed-in users can view log records. Supervisor or admin access is required for review actions and management tabs.</div>
      )}
      {!user && (
        <div className="notice notice-warning">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span>Sign in with a supervisor or admin account to access this dashboard.</span>
            <span style={{ display: "flex", gap: 10 }}>
              <Link className="btn btn-primary btn-sm" href="/login?redirect=/admin">Sign in →</Link>
              <Link className="btn btn-outline btn-sm" href="/setup">First time? Run setup →</Link>
            </span>
          </div>
        </div>
      )}

      <div className="admin-tabs">
        {visibleTabs.map((t) => (
          <button key={t} className={`admin-tab ${activeTab === t ? "active" : ""}`} type="button" onClick={() => setTab(t)}>
            {t === "records" && <TabRecordsIcon />}
            {t === "instruments" && <TabInstrumentsIcon />}
            {t === "users" && <TabUsersIcon />}
            {t === "records" ? "Log Records" : t === "instruments" ? "Instrument Templates" : "User Management"}
          </button>
        ))}
      </div>

      {activeTab === "records"     && <RecordsTab user={user} isAdmin={isAdmin} />}
      {isAdmin && activeTab === "instruments" && <InstrumentsTab user={user} isAdmin={isAdmin} />}
      {isAdmin && activeTab === "users"       && <UsersTab user={user} isAdmin={isAdmin} />}
      </div>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 1 — Records
   ════════════════════════════════════════════════════════════════════════════ */

function RecordsTab({ user, isAdmin }: { user: AppUser | null; isAdmin: boolean }) {
  const [records, setRecords] = useState<LogbookRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
  const [query, setQuery] = useState("");
  const [analystFilter, setAnalystFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeComment, setActiveComment] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());

  function isExpanded(rec: LogbookRecord): boolean {
    const defaultOpen = rec.status === "Pending";
    return toggledIds.has(rec.id) ? !defaultOpen : defaultOpen;
  }

  function toggleCard(id: string) {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => { loadRecords(); }, []);

  async function loadRecords() {
    setLoading(true);
    const r = await fetch("/api/logbook");
    if (r.ok) { const d = await r.json(); setRecords(d.records); }
    setLoading(false);
  }

  async function review(id: string, status: LogbookStatus) {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      const r = await fetch("/api/logbook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, supervisorComment: activeComment[id] || "", reviewedBy: user?.fullName || "Supervisor" }),
      });
      if (r.ok) await loadRecords();
    } finally {
      setReviewingId(null);
    }
  }

  const analysts = useMemo(() => {
    return Array.from(new Set(records.map((rec) => rec.analyst).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter((rec) => {
      const matchStatus = statusFilter === "All" || rec.status === statusFilter;
      const recordDate = rec.date || rec.createdAt.slice(0, 10);
      const matchAnalyst = analystFilter === "All" || rec.analyst === analystFilter;
      const matchDateFrom = !dateFrom || recordDate >= dateFrom;
      const matchDateTo = !dateTo || recordDate <= dateTo;
      const matchSearch = !search || [
        rec.instrumentName,
        rec.instrumentId,
        rec.analyst,
        rec.sampleId,
        rec.methodUsed,
        rec.date,
        rec.createdAt,
        rec.status,
        rec.reviewedBy || "",
        rec.department,
        rec.location,
      ]
        .join(" ").toLowerCase().includes(search);
      return matchStatus && matchAnalyst && matchDateFrom && matchDateTo && matchSearch;
    });
  }, [records, statusFilter, query, analystFilter, dateFrom, dateTo]);

  const pending  = records.filter((r) => r.status === "Pending").length;
  const approved = records.filter((r) => r.status === "Approved").length;
  const rejected = records.filter((r) => r.status === "Rejected").length;

  return (
    <>
      <div className="metrics-grid">
        <MetricCard label="Pending"       value={pending}         tone="amber" active={statusFilter === "Pending"}  onClick={() => setStatusFilter("Pending")} />
        <MetricCard label="Approved"      value={approved}        tone="green" active={statusFilter === "Approved"} onClick={() => setStatusFilter("Approved")} />
        <MetricCard label="Rejected"      value={rejected}        tone="red"   active={statusFilter === "Rejected"} onClick={() => setStatusFilter("Rejected")} />
        <MetricCard label="Total Records" value={records.length}  tone="blue"  active={statusFilter === "All"}      onClick={() => setStatusFilter("All")} />
      </div>

      <div className="toolbar">
        <input
          className="toolbar-search"
          placeholder="Search by analyst, date, instrument, method, status, or sample ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="toolbar-field">
          <span>Analyst</span>
          <select value={analystFilter} onChange={(e) => setAnalystFilter(e.target.value)}>
            <option value="All">All analysts</option>
            {analysts.map((analyst) => <option key={analyst} value={analyst}>{analyst}</option>)}
          </select>
        </label>
        <label className="toolbar-field">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="toolbar-field">
          <span>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <div className="seg-ctrl">
          {(["All", "Pending", "Approved", "Rejected"] as FilterStatus[]).map((s) => (
            <button key={s} type="button" className={`seg-btn ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
        <span className="toolbar-count">{filtered.length} shown</span>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => { setQuery(""); setAnalystFilter("All"); setDateFrom(""); setDateTo(""); setStatusFilter("All"); }}
        >
          Clear
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={loadRecords}>Refresh</button>
      </div>

      <div className="records-panel">
        {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 8 }} />)}
        {!loading && filtered.length === 0 && (
          <div className="empty-state"><div className="empty-state-icon"><RailReviewIcon /></div><p>No records match the current filter.</p></div>
        )}
        {filtered.map((rec) => {
          const signature = parseAnalystSignature(rec.analystSignature);
          const runTime = formatRunTime(rec.startTime, rec.endTime);
          const expanded = isExpanded(rec);
          return (
          <article className="record-card" key={rec.id} data-status={rec.status}>
            <div className="record-card-header" onClick={() => toggleCard(rec.id)}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="record-title">{rec.instrumentName || "Unnamed instrument"}</p>
                <p className="record-meta">
                  {rec.sampleId || "—"} &nbsp;·&nbsp; {rec.analyst || "—"} &nbsp;·&nbsp; {rec.date || "—"} &nbsp;·&nbsp; {runTime || "—"}
                </p>
              </div>
              <div className="record-header-right">
                <StatusPill status={rec.status} />
                <span className={`record-chevron${expanded ? " open" : ""}`}>
                  <ChevronIcon />
                </span>
              </div>
            </div>

            {expanded && (
              <div className="record-body">
                <div className="record-summary-grid">
                  <RecordSummaryItem label="Analyst"   value={rec.analyst} />
                  <RecordSummaryItem label="Sample"    value={rec.sampleId} />
                  <RecordSummaryItem label="Date"      value={rec.date} />
                  <RecordSummaryItem label="Run Time"  value={runTime} />
                  <RecordSummaryItem label="Method"    value={rec.methodUsed} />
                  <RecordSummaryItem label="Signature" value={signatureSummary(rec.analystSignature)} />
                </div>

                <details className="record-full-details">
                  <summary>Full submitted record</summary>
                  <div className="record-details-grid">
                    <RecordDetail label="Analyst"       value={rec.analyst} />
                    <RecordDetail label="Sample ID"     value={rec.sampleId} />
                    <RecordDetail label="Record Date"   value={rec.date} />
                    <RecordDetail label="Run Time"      value={runTime} />
                    <RecordDetail label="Method"        value={rec.methodUsed} />
                    <RecordDetail label="Instrument"    value={rec.instrumentName} />
                    <RecordDetail label="Instrument ID" value={rec.instrumentId} />
                    <RecordDetail label="Model"         value={rec.instrumentModel} />
                    <RecordDetail label="Serial No."    value={rec.serialNumber} />
                    <RecordDetail label="Manufacturer"  value={rec.manufacturer} />
                    <RecordDetail label="Installation"  value={rec.installationDate} />
                    <RecordDetail label="Laboratory"    value={rec.laboratoryName} />
                    <RecordDetail label="Department"    value={rec.department} />
                    <RecordDetail label="Location"      value={rec.location} />
                    <RecordDetail label="Submitted"     value={new Date(rec.createdAt).toLocaleString()} />
                    <RecordDetail label="Signature"     value={signatureSummary(rec.analystSignature)} />
                  </div>
                  <SignatureReview signature={signature} />
                  {rec.remarks && (
                    <div className="remarks-box">
                      <p className="remarks-label">Remarks</p>
                      <p>{rec.remarks}</p>
                    </div>
                  )}
                </details>

                {rec.reviewedBy && (
                  <div className="notice notice-success" style={{ margin: 0, fontSize: 14 }}>
                    Reviewed by <strong>{rec.reviewedBy}</strong>
                    {rec.reviewedAt ? ` · ${new Date(rec.reviewedAt).toLocaleString()}` : ""}
                    {rec.supervisorComment && <> · &ldquo;{rec.supervisorComment}&rdquo;</>}
                  </div>
                )}
              </div>
            )}

            {expanded && isAdmin && rec.status === "Pending" && (
              <div className="record-footer">
                <div className="comment-field">
                  <textarea
                    placeholder="Add a supervisor comment (optional)…"
                    value={activeComment[rec.id] ?? rec.supervisorComment}
                    onChange={(e) => setActiveComment((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                  />
                </div>
                <div className="record-actions">
                  <button className="btn btn-approve btn-sm" type="button" disabled={reviewingId === rec.id} onClick={() => review(rec.id, "Approved")}>
                    {reviewingId === rec.id ? "Saving..." : "Approve"}
                  </button>
                  <button className="btn btn-reject btn-sm" type="button" disabled={reviewingId === rec.id} onClick={() => review(rec.id, "Rejected")}>
                    {reviewingId === rec.id ? "Saving..." : "Reject"}
                  </button>
                </div>
              </div>
            )}
          </article>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 2 — Instrument Templates
   ════════════════════════════════════════════════════════════════════════════ */

const EMPTY_TEMPLATE = {
  categoryId: "", instrumentName: "", instrumentModel: "", serialNumber: "",
  manufacturer: "Thermo Scientific", installationDate: "", instrumentId: "",
  laboratoryName: "", department: "", location: "", methodUsed: "", displayOrder: 0,
};

function InstrumentsTab({ isAdmin }: { user: AppUser | null; isAdmin: boolean }) {
  const [categories, setCategories] = useState<InstrumentCategory[]>([]);
  const [templates, setTemplates] = useState<InstrumentTemplate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<null | "add" | "edit">(null);
  const [editing, setEditing]   = useState<InstrumentTemplate | null>(null);
  const [form, setForm]         = useState(EMPTY_TEMPLATE);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [catR, tplR] = await Promise.all([
      fetch("/api/templates/categories").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setCategories(catR.categories || []);
    setTemplates(tplR.templates || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ ...EMPTY_TEMPLATE, categoryId: categories[0]?.id || "" });
    setEditing(null); setModal("add");
  }

  function openEdit(tpl: InstrumentTemplate) {
    setForm({ categoryId: tpl.categoryId, instrumentName: tpl.instrumentName, instrumentModel: tpl.instrumentModel,
      serialNumber: tpl.serialNumber, manufacturer: tpl.manufacturer, installationDate: tpl.installationDate,
      instrumentId: tpl.instrumentId, laboratoryName: tpl.laboratoryName, department: tpl.department,
      location: tpl.location, methodUsed: tpl.methodUsed, displayOrder: tpl.displayOrder });
    setEditing(tpl); setModal("edit");
  }

  async function saveTemplate() {
    setSaving(true);
    const url = modal === "edit" ? `/api/templates?id=${editing!.id}` : "/api/templates";
    const r = await fetch(url, { method: modal === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { setNotice({ type: "success", text: modal === "edit" ? "Template updated." : "Template created." }); setModal(null); loadAll(); }
    else       { setNotice({ type: "error", text: "Save failed. Check all fields." }); }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this instrument template? This cannot be undone.")) return;
    setDeleting(id);
    const r = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    if (r.ok) { setNotice({ type: "success", text: "Template deleted." }); loadAll(); }
    setDeleting(null);
  }

  function catClass(name: string) {
    const n = name.toLowerCase();
    return `cat-badge cat-badge-${n}`;
  }

  return (
    <div>
      {notice && (
        <div className={`notice notice-${notice.type}`} style={{ marginBottom: 14 }}>
          {notice.text}
          <button style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Instrument Templates</h2>
          <p style={{ fontSize: 15, color: "var(--muted)", marginTop: 3 }}>
            Edit instrument details here — analysts see these auto-filled.
          </p>
        </div>
        {isAdmin && <button className="btn btn-primary btn-sm" type="button" onClick={openAdd}>+ Add Instrument</button>}
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th><th>Instrument</th><th>Model</th><th>Instrument ID</th>
                <th>Serial No.</th><th>Laboratory</th><th>Method</th>
                {isAdmin && <th style={{ width: 130 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr><td colSpan={8} className="empty-state">No instrument templates found.</td></tr>
              )}
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td><span className={catClass(tpl.categoryName)}>{tpl.categoryName}</span></td>
                  <td style={{ fontWeight: 700 }}>{tpl.instrumentName}</td>
                  <td className="mono">{tpl.instrumentModel || <Muted>—</Muted>}</td>
                  <td className="mono">{tpl.instrumentId || <Muted>—</Muted>}</td>
                  <td className="mono">{tpl.serialNumber || <Muted>—</Muted>}</td>
                  <td>{tpl.laboratoryName || <Muted>—</Muted>}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.methodUsed || <Muted>—</Muted>}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => openEdit(tpl)}>Edit</button>
                        <button className="btn btn-danger btn-sm" type="button" disabled={deleting === tpl.id} onClick={() => deleteTemplate(tpl.id)}>
                          {deleting === tpl.id ? "…" : "Del"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <p className="modal-title">{modal === "add" ? "Add Instrument Template" : "Edit Instrument Template"}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-form-grid">
                <div className="field">
                  <label className="field-label">Category <span className="req">*</span></label>
                  <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Instrument Name <span className="req">*</span></label>
                  <input value={form.instrumentName} onChange={(e) => setForm((p) => ({ ...p, instrumentName: e.target.value }))} placeholder="e.g. ICP-OES" />
                </div>
                <div className="field">
                  <label className="field-label">Instrument Model</label>
                  <input value={form.instrumentModel} onChange={(e) => setForm((p) => ({ ...p, instrumentModel: e.target.value }))} placeholder="e.g. iCAP 7400" />
                </div>
                <div className="field">
                  <label className="field-label">Instrument ID</label>
                  <input value={form.instrumentId} onChange={(e) => setForm((p) => ({ ...p, instrumentId: e.target.value }))} placeholder="e.g. ICP-OES-001" />
                </div>
                <div className="field">
                  <label className="field-label">Serial Number</label>
                  <input value={form.serialNumber} onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))} placeholder="e.g. SN-123456" />
                </div>
                <div className="field">
                  <label className="field-label">Manufacturer</label>
                  <input value={form.manufacturer} onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Installation Date</label>
                  <input type="date" value={form.installationDate} onChange={(e) => setForm((p) => ({ ...p, installationDate: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Laboratory Name</label>
                  <input value={form.laboratoryName} onChange={(e) => setForm((p) => ({ ...p, laboratoryName: e.target.value }))} placeholder="e.g. Analytical Lab" />
                </div>
                <div className="field">
                  <label className="field-label">Department</label>
                  <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} placeholder="e.g. Chemistry" />
                </div>
                <div className="field">
                  <label className="field-label">Location / Room</label>
                  <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. Room 201, Block A" />
                </div>
                <div className="field full-width">
                  <label className="field-label">Default Method Used</label>
                  <input value={form.methodUsed} onChange={(e) => setForm((p) => ({ ...p, methodUsed: e.target.value }))} placeholder="e.g. Elemental analysis by ICP-OES" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" type="button" disabled={saving || !form.instrumentName || !form.categoryId} onClick={saveTemplate}>
                {saving ? "Saving…" : modal === "edit" ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 3 — Users
   ════════════════════════════════════════════════════════════════════════════ */

function UsersTab({ user, isAdmin }: { user: AppUser | null; isAdmin: boolean }) {
  const [profiles, setProfiles]         = useState<ProfilePublic[]>([]);
  const [loading, setLoading]           = useState(true);
  const [provisioningAll, setProvisioningAll] = useState(false);
  const [editTarget, setEditTarget]     = useState<ProfilePublic | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving]     = useState(false);
  const [showEditPw, setShowEditPw]     = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [resetting, setResetting]       = useState<string | null>(null);
  const [notice, setNotice]             = useState<{ type: "success" | "error"; text: string } | null>(null);
  const genByEmail = useMemo(() => new Map(GENERATED_USER_ACCOUNTS.map((g) => [g.email, g])), []);

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (r.ok) { const d = await r.json(); setProfiles(d.profiles || []); }
    setLoading(false);
  }

  async function provisionAll() {
    if (!confirm("Create all 18 accounts in Supabase Auth? Already-existing accounts will be skipped.")) return;
    setProvisioningAll(true);
    const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "provisionAll" }) });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: `${d.created} accounts created, ${d.skipped} already existed.` }); loadProfiles(); }
    else       { setNotice({ type: "error", text: d.error || "Provisioning failed." }); }
    setProvisioningAll(false);
  }

  function openEdit(profile: ProfilePublic) {
    setEditTarget(profile);
    setEditUsername(profile.username);
    setEditPassword("");
    setShowEditPw(false);
  }

  async function saveEdit() {
    if (!editTarget) return;
    const newUsername = editUsername.trim() !== editTarget.username && editUsername.trim() ? editUsername.trim() : undefined;
    const newPassword = editPassword.trim() || undefined;
    if (!newUsername && !newPassword) { setEditTarget(null); return; }
    setEditSaving(true);
    const r = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: editTarget.username, action: "updateCredentials", newUsername, newPassword }),
    });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: "User updated successfully." }); setEditTarget(null); loadProfiles(); }
    else       { setNotice({ type: "error", text: d.error || "Update failed." }); }
    setEditSaving(false);
  }

  async function removeUser(username: string) {
    if (!confirm(`Remove "${username}"? This permanently deletes their account and cannot be undone.`)) return;
    setDeleting(username);
    const r = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (r.ok) { setNotice({ type: "success", text: `"${username}" has been removed.` }); loadProfiles(); }
    else { const d = await r.json(); setNotice({ type: "error", text: d.error || "Delete failed." }); }
    setDeleting(null);
  }

  async function resetPassword(profile: ProfilePublic) {
    setResetting(profile.username);
    const r = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: profile.username, action: "resetPassword" }),
    });
    if (r.ok) { setNotice({ type: "success", text: `Password reset to the configured temporary password for ${profile.username}.` }); }
    else { const d = await r.json(); setNotice({ type: "error", text: d.error || "Reset failed." }); }
    setResetting(null);
  }

  // Merge profiles from the DB with the public generated-account list for display.
  const provisionedEmails = new Set(profiles.map((p) => p.email));
  const unprovisionedGens = GENERATED_USER_ACCOUNTS.filter((g) => !provisionedEmails.has(g.email));

  const adminProfiles    = profiles.filter((p) => p.role === "admin");
  const analystProfiles  = profiles.filter((p) => p.role === "analyst");
  const unprovAdmins     = unprovisionedGens.filter((g) => g.role === "admin");
  const unprovAnalysts   = unprovisionedGens.filter((g) => g.role === "analyst");

  return (
    <div>
      {notice && (
        <div className={`notice notice-${notice.type}`} style={{ marginBottom: 14 }}>
          {notice.text}
          <button style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 16 }}>User Accounts</h2>
          <p style={{ fontSize: 15, color: "var(--muted)", marginTop: 3 }}>
            {profiles.length} of {GENERATED_USER_ACCOUNTS.length} accounts provisioned. Users must change password on first login.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" type="button" disabled={provisioningAll} onClick={provisionAll}>
            {provisioningAll ? "Provisioning…" : "Provision All Users"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 400, borderRadius: 8 }} />
      ) : (
        <>
          <UserSection
            title="Supervisors / Admins"
            profiles={adminProfiles}
            unprovisioned={unprovAdmins}
            genByEmail={genByEmail}
            isAdmin={isAdmin}
            currentUsername={user?.username}
            deleting={deleting}
            resetting={resetting}
            onEdit={openEdit}
            onDelete={removeUser}
            onReset={resetPassword}
          />

          <div style={{ height: 24 }} />

          <UserSection
            title="Analysts"
            profiles={analystProfiles}
            unprovisioned={unprovAnalysts}
            genByEmail={genByEmail}
            isAdmin={isAdmin}
            currentUsername={user?.username}
            deleting={deleting}
            resetting={resetting}
            onEdit={openEdit}
            onDelete={removeUser}
            onReset={resetPassword}
          />
        </>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <p className="modal-title">Edit User — {editTarget.username}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditTarget(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "grid", gap: 16 }}>
              <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 15 }}>
                <p style={{ color: "var(--muted)", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0, marginBottom: 4 }}>Current account</p>
                <p><strong>{editTarget.fullName}</strong> · {editTarget.email}</p>
              </div>
              <div className="field">
                <label className="field-label">Username</label>
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="New username"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label className="field-label">New Password <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none", fontSize: 14 }}>(leave blank to keep current)</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showEditPw ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password…"
                    autoComplete="new-password"
                    style={{ paddingRight: 72 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowEditPw((p) => !p)}
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}
                  >
                    {showEditPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.55 }}>
                Changing the username updates how this person logs in. The user will be asked to change their password on next login if you reset it.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" type="button" disabled={editSaving} onClick={saveEdit}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserSection({
  title, profiles, unprovisioned, genByEmail, isAdmin, currentUsername,
  deleting, resetting, onEdit, onDelete, onReset,
}: {
  title: string;
  profiles: ProfilePublic[];
  unprovisioned: GeneratedUserAccount[];
  genByEmail: Map<string, GeneratedUserAccount>;
  isAdmin: boolean;
  currentUsername?: string;
  deleting: string | null;
  resetting: string | null;
  onEdit: (p: ProfilePublic) => void;
  onDelete: (u: string) => void;
  onReset: (p: ProfilePublic) => void;
}) {
  const total = profiles.length + unprovisioned.length;
  return (
    <div>
      <h3 style={{ marginBottom: 10, fontSize: 14, color: "var(--ink-2)" }}>
        {title} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({total})</span>
      </h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Temporary Password</th>
              <th>Status</th>
              {isAdmin && <th style={{ width: 200 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {/* Provisioned rows */}
            {profiles.map((p, i) => {
              const gen = genByEmail.get(p.email);
              const isSelf = p.username === currentUsername;
              const isDeleting  = deleting  === p.username;
              const isResetting = resetting === p.username;
              return (
                <tr key={p.id}>
                  <td style={{ color: "var(--muted)", fontSize: 14 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>{p.username}</td>
                  <td>{p.fullName}</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 14, color: "var(--muted)" }}>{p.email}</td>
                  <td>
                    {gen ? <Muted>Configured privately</Muted> : <Muted>-</Muted>}
                  </td>
                  <td>
                    <span className="status-dot status-dot-active">Active</span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => onEdit(p)}>Edit</button>
                        <button className="btn btn-outline btn-sm" type="button" disabled={isResetting} onClick={() => onReset(p)} title="Reset to initial password">
                          {isResetting ? "…" : "Reset pwd"}
                        </button>
                        {!isSelf && (
                          <button className="btn btn-danger btn-sm" type="button" disabled={isDeleting} onClick={() => onDelete(p.username)}>
                            {isDeleting ? "…" : "Remove"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {/* Unprovisioned rows */}
            {unprovisioned.map((g, i) => (
              <tr key={g.username} style={{ opacity: .6 }}>
                <td style={{ color: "var(--muted)", fontSize: 14 }}>{profiles.length + i + 1}</td>
                <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{g.username}</td>
                <td>{g.fullName}</td>
                <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 14, color: "var(--muted)" }}>{g.email}</td>
                <td><Muted>Configured privately</Muted></td>
                <td><span className="status-dot status-dot-inactive">Not provisioned</span></td>
                {isAdmin && <td><Muted>Provision first</Muted></td>}
              </tr>
            ))}
            {profiles.length === 0 && unprovisioned.length === 0 && (
              <tr><td colSpan={7} className="empty-state">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Shared components
   ════════════════════════════════════════════════════════════════════════════ */

function LabLogo() {
  return (
    <div className="lab-logo" style={{ width: 46, height: 46 }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6m-3 0v6l4 8a2 2 0 01-1.8 3H9.8a2 2 0 01-1.8-3l4-8V3" />
        <path d="M6 17h12" />
      </svg>
    </div>
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

function MetricCard({ label, value, tone, active, onClick }: { label: string; value: number; tone: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`metric-card tone-${tone} ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </button>
  );
}

function StatusPill({ status }: { status: LogbookStatus }) {
  const cls = status === "Pending" ? "pill-pending" : status === "Approved" ? "pill-approved" : "pill-rejected";
  return <span className={`pill ${cls}`}><span className="pill-dot" />{status}</span>;
}

function RecordDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="record-detail-cell">
      <p className="record-detail-label">{label}</p>
      <p className="record-detail-value">{value || "—"}</p>
    </div>
  );
}

function RecordSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="record-summary-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function SignatureReview({ signature }: { signature: AnalystSignaturePayload }) {
  if (!signature.image && !signature.typed) return null;

  return (
    <div className="signature-review">
      <div>
        <p className="signature-review-label">Analyst Sign-off</p>
        <p className="signature-review-meta">
          {signature.signedBy || signature.typed || "Analyst"}
          {signature.username ? ` · ${signature.username}` : ""}
          {signature.signedAt ? ` · ${new Date(signature.signedAt).toLocaleString()}` : ""}
        </p>
      </div>
      {signature.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="signature-review-image" src={signature.image} alt="Analyst signature" />
      ) : (
        <p className="signature-review-typed">{signature.typed}</p>
      )}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--muted-2)", fontStyle: "italic" }}>{children}</span>;
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function TabRecordsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function TabInstrumentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6m-3 0v6l4 8a2 2 0 01-1.8 3H9.8a2 2 0 01-1.8-3l4-8V3" />
      <path d="M6 17h12" />
    </svg>
  );
}

function TabUsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
