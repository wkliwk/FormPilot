"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  digestEnabled: boolean;
  reminderEmailsEnabled: boolean;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function update(patch: Partial<Settings>) {
    if (!settings) return;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // Revert on failure
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900">Settings</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="bg-slate-100 rounded-2xl h-20" />
            <div className="bg-slate-100 rounded-2xl h-20" />
          </div>
        ) : settings ? (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Email notifications</p>
              <div className="space-y-5">
                {/* Weekly digest */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Weekly digest</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      A Monday summary of your in-progress forms and upcoming deadlines.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.digestEnabled}
                    onChange={(v) => update({ digestEnabled: v })}
                    disabled={saving}
                  />
                </div>

                {/* Reminder emails */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Deadline reminders</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Email alerts when a form deadline is approaching.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.reminderEmailsEnabled}
                    onChange={(v) => update({ reminderEmailsEnabled: v })}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Account</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Billing &amp; plan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Manage your subscription and invoices.</p>
                </div>
                <Link
                  href="/dashboard/billing"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to load settings.</p>
        )}

        {saving && (
          <p className="text-xs text-slate-400 mt-4 text-right">Saving…</p>
        )}
      </main>
    </div>
  );
}
