"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { AppUser } from "@/lib/logbook";
import { UserAvatar } from "@/components/UserAvatar";

type Notice = { type: "success" | "error"; text: string } | null;

export default function SettingsPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [username, setUsername] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Telegram state
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgBotTokenSet, setTgBotTokenSet] = useState(false);
  const [tgConfigured, setTgConfigured] = useState(false);
  const [tgNotice, setTgNotice] = useState<Notice>(null);
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);

  const canAccessAdmin = user?.role === "admin" || user?.role === "supervisor";

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setUsername(d.user.username);
          setAvatarSeed(d.user.avatarSeed);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canAccessAdmin) return;
    fetch("/api/admin/telegram")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTgConfigured(d.configured);
        setTgBotTokenSet(d.botTokenSet);
        setTgChatId(d.chatId || "");
      });
  }, [canAccessAdmin]);

  function generateAvatar() {
    const random = new Uint32Array(2);
    crypto.getRandomValues(random);
    setAvatarSeed(`avatar_${random[0].toString(36)}_${random[1].toString(36)}`);
    setProfileNotice(null);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);

    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatarSeed }),
    });
    const result = await response.json();

    if (!response.ok) {
      setProfileNotice({ type: "error", text: result.error || "Profile update failed." });
      setSavingProfile(false);
      return;
    }

    setUser(result.user);
    setUsername(result.user.username);
    setAvatarSeed(result.user.avatarSeed);
    setProfileNotice({ type: "success", text: "Profile updated." });
    setSavingProfile(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordNotice({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPasswordNotice({ type: "error", text: result.error || "Password change failed." });
      setSavingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordNotice({ type: "success", text: "Password changed." });
    setSavingPassword(false);
  }

  async function saveTelegram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTgNotice(null);
    if (!tgBotToken && !tgBotTokenSet) {
      setTgNotice({ type: "error", text: "Enter a bot token." });
      return;
    }
    setSavingTg(true);
    const response = await fetch("/api/admin/telegram", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken: tgBotToken || undefined, chatId: tgChatId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setTgNotice({ type: "error", text: result.error || "Save failed." });
    } else {
      setTgBotTokenSet(true);
      setTgConfigured(!!(tgBotToken || tgBotTokenSet) && !!tgChatId);
      setTgBotToken("");
      setTgNotice({ type: "success", text: "Telegram config saved." });
    }
    setSavingTg(false);
  }

  async function testTelegram() {
    setTgNotice(null);
    setTestingTg(true);
    const response = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const result = await response.json().catch(() => ({}));
    if (result.sent) {
      setTgNotice({ type: "success", text: "Test message sent successfully." });
    } else {
      setTgNotice({ type: "error", text: result.reason || "Test failed." });
    }
    setTestingTg(false);
  }

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Primary navigation">
        <div className="rail-brand">
          <LabIcon />
          <span>Account</span>
        </div>
        <nav className="rail-nav">
          <Link className="rail-link" href="/">
            <EntryIcon />
            <span>Entry</span>
          </Link>
          <Link className="rail-link" href="/admin">
            <ReviewIcon />
            <span>{canAccessAdmin ? "Admin" : "Logs"}</span>
          </Link>
          <Link className="rail-link active" href="/settings">
            <SettingsIcon />
            <span>Settings</span>
          </Link>
        </nav>
      </aside>

      <div className="app-frame settings-frame">
        <header className="topbar">
          <div className="brand-heading">
            <LabIcon />
            <div className="brand-text">
              <p className="eyebrow">Account Settings</p>
              <h1>Profile and security</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="btn btn-outline btn-sm" href="/">Analyst Entry</Link>
            <Link className="btn btn-primary btn-sm" href={canAccessAdmin ? "/admin" : "/login?redirect=/admin"}>
              {canAccessAdmin ? "Admin Dashboard" : "Admin Login"}
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="settings-grid">
            <div className="skeleton" style={{ height: 340 }} />
            <div className="skeleton" style={{ height: 340 }} />
          </div>
        ) : !user ? (
          <section className="panel settings-empty">
            <div className="empty-state">
              <div className="empty-state-icon"><SettingsIcon /></div>
              <p>Sign in to change your username, avatar, or password.</p>
              <Link className="btn btn-primary" href="/login?redirect=/settings">Sign in</Link>
            </div>
          </section>
        ) : (
          <div className="settings-grid">
            <section className="panel settings-panel">
              <div className="settings-hero">
                <UserAvatar name={username} seed={avatarSeed} size="lg" />
                <div>
                  <h2>{user.fullName}</h2>
                  <p>{user.email}</p>
                  <span className={`role-badge role-badge-${user.role}`}>{user.role}</span>
                </div>
              </div>

              <form className="settings-form" onSubmit={saveProfile}>
                <div className="field">
                  <label className="field-label" htmlFor="username">Username</label>
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="username"
                    required
                  />
                </div>

                <div className="avatar-setting">
                  <UserAvatar name={username} seed={avatarSeed} size="lg" />
                  <div>
                    <p className="avatar-setting-title">Profile picture</p>
                    <p className="avatar-setting-copy">Generated avatar for now. Regenerate it until you get one you like.</p>
                    <button className="btn btn-outline btn-sm" type="button" onClick={generateAvatar}>
                      Generate New Avatar
                    </button>
                  </div>
                </div>

                {profileNotice && (
                  <p className={`notice notice-${profileNotice.type}`} style={{ margin: 0 }}>{profileNotice.text}</p>
                )}

                <button className="btn btn-primary btn-lg" type="submit" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </section>

            <section className="panel settings-panel">
              <div className="section-heading">
                <span className="section-number"><LockIcon /></span>
                <div className="section-heading-text">
                  <h2>Change password</h2>
                  <p>Use at least 8 characters. Your next login will use the new password.</p>
                </div>
              </div>

              <form className="settings-form" onSubmit={savePassword}>
                <div className="field">
                  <label className="field-label" htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    required
                  />
                </div>

                {passwordNotice && (
                  <p className={`notice notice-${passwordNotice.type}`} style={{ margin: 0 }}>{passwordNotice.text}</p>
                )}

                <button className="btn btn-primary btn-lg" type="submit" disabled={savingPassword}>
                  {savingPassword ? "Saving..." : "Change Password"}
                </button>
              </form>
            </section>

            {canAccessAdmin && (
              <section className="panel settings-panel" style={{ gridColumn: "1 / -1" }}>
                <div className="section-heading">
                  <span className="section-number"><TelegramIcon /></span>
                  <div className="section-heading-text">
                    <h2>Telegram notifications</h2>
                    <p>
                      Receive a message when analysts submit new logbook entries.{" "}
                      <a href="https://core.telegram.org/bots#how-do-i-create-a-bot" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>
                        How to create a bot
                      </a>
                    </p>
                  </div>
                  {tgConfigured && (
                    <span className="role-badge role-badge-supervisor" style={{ marginLeft: "auto", alignSelf: "flex-start" }}>
                      Active
                    </span>
                  )}
                </div>

                <form className="settings-form" onSubmit={saveTelegram}>
                  <div className="form-grid-2">
                    <div className="field">
                      <label className="field-label" htmlFor="tgBotToken">
                        Bot Token
                      </label>
                      <input
                        id="tgBotToken"
                        type="password"
                        value={tgBotToken}
                        onChange={(e) => setTgBotToken(e.target.value)}
                        autoComplete="off"
                        placeholder={tgBotTokenSet ? "Already set — paste new token to update" : "123456789:AAF..."}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="tgChatId">
                        Chat ID
                      </label>
                      <input
                        id="tgChatId"
                        type="text"
                        value={tgChatId}
                        onChange={(e) => setTgChatId(e.target.value)}
                        autoComplete="off"
                        placeholder="-100123456789"
                      />
                    </div>
                  </div>

                  <p className="field-hint">
                    Get your Chat ID by messaging your bot and calling{" "}
                    <code style={{ fontSize: "0.85em", background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
                      getUpdates
                    </code>{" "}
                    on the Telegram API, or use{" "}
                    <code style={{ fontSize: "0.85em", background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
                      @userinfobot
                    </code>.
                  </p>

                  {tgNotice && (
                    <p className={`notice notice-${tgNotice.type}`} style={{ margin: 0 }}>{tgNotice.text}</p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-lg" type="submit" disabled={savingTg}>
                      {savingTg ? "Saving..." : "Save"}
                    </button>
                    {tgConfigured && (
                      <button
                        className="btn btn-outline btn-lg"
                        type="button"
                        onClick={testTelegram}
                        disabled={testingTg}
                      >
                        {testingTg ? "Sending..." : "Send Test Message"}
                      </button>
                    )}
                  </div>
                </form>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function LabIcon() {
  return (
    <div className="lab-logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6m-3 0v6l4 8a2 2 0 0 1-1.8 3H9.8a2 2 0 0 1-1.8-3l4-8V3" />
        <path d="M6 17h12" />
      </svg>
    </div>
  );
}

function EntryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
