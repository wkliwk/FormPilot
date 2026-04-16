"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  fieldLabel: string;       // form field label, e.g. "Phone number"
  profileKey: string;       // profile key, e.g. "phone"
  profileLabel: string;     // human label, e.g. "Phone number"
  formId: string;
  onSaved: () => void;      // called after profile saved — triggers re-autofill
  onClose: () => void;
}

export default function ProfileGapSlideOver({ fieldLabel, profileKey, profileLabel, formId, onSaved, onClose }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactCount, setImpactCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSave() {
    if (!value.trim()) {
      setError("Please enter a value");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: profileKey, value: value.trim() }),
      });
      const data = await res.json() as { success?: boolean; impactCount?: number; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save. Try again.");
        return;
      }
      setImpactCount(data.impactCount ?? 0);
      // Mark gap as dismissed for this field in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`gapDismissed:${formId}:${profileKey}`, "1");
      }
      onSaved();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gap-slideover-title"
        className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2 mb-1 pr-6">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <h2 id="gap-slideover-title" className="text-sm font-bold text-slate-900">
              Profile data missing
            </h2>
          </div>
          <p className="text-xs text-slate-500 pl-9">
            <span className="font-medium text-slate-700">{fieldLabel}</span> couldn&apos;t be autofilled — your profile is missing <span className="font-medium text-slate-700">{profileLabel}</span>.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label htmlFor="gap-value-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {profileLabel}
            </label>
            <input
              ref={inputRef}
              id="gap-value-input"
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder={`Enter your ${profileLabel.toLowerCase()}`}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>

          {impactCount !== null && impactCount > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-xs text-emerald-700 font-medium">
                This will also improve {impactCount} other form{impactCount !== 1 ? "s" : ""} in your library
              </p>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl px-3.5 py-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              This value will be saved to your profile and used to autofill similar fields in future forms. You can update it anytime in your profile settings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {saving ? "Saving…" : "Save & autofill"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}
