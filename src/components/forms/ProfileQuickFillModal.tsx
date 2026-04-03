"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ExtractedFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  employerName?: string;
  jobTitle?: string;
  annualIncome?: string;
  ssn?: string;
  passportNumber?: string;
  driverLicense?: string;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  dateOfBirth: "Date of birth",
  employerName: "Employer",
  jobTitle: "Job title",
  annualIncome: "Annual income",
  ssn: "Social Security number",
  passportNumber: "Passport number",
  driverLicense: "Driver's license",
  "address.street": "Street address",
  "address.city": "City",
  "address.state": "State",
  "address.zip": "ZIP code",
  "address.country": "Country",
};

function flattenFields(fields: ExtractedFields): Array<{ key: string; label: string; value: string }> {
  const result: Array<{ key: string; label: string; value: string }> = [];
  const { address, ...top } = fields;
  for (const [k, v] of Object.entries(top)) {
    if (v && typeof v === "string") {
      result.push({ key: k, label: FIELD_LABELS[k] ?? k, value: v });
    }
  }
  if (address && typeof address === "object") {
    for (const [k, v] of Object.entries(address)) {
      if (v && typeof v === "string") {
        result.push({ key: `address.${k}`, label: FIELD_LABELS[`address.${k}`] ?? k, value: v });
      }
    }
  }
  return result;
}

export default function ProfileQuickFillModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [currentData, setCurrentData] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openModal = useCallback(async () => {
    setOpen(true);
    setExtracted(null);
    setError(null);
    setText("");
    setSaved(false);
    setOverrides(new Set());
    // Load current profile data
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json() as { data: Record<string, unknown> | null };
        setCurrentData(data.data ?? {});
      }
    } catch {
      setCurrentData({});
    }
  }, []);

  async function handleExtract() {
    if (text.trim().length < 200) return;
    setLoading(true);
    setError(null);
    setExtracted(null);
    try {
      const res = await fetch("/api/profile/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { fields?: ExtractedFields; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Extraction failed. Please try again.");
        return;
      }
      const fields = data.fields ?? {};
      if (Object.keys(fields).length === 0) {
        setError("We couldn't extract profile data from that text. Try pasting a more detailed bio or CV.");
        return;
      }
      setExtracted(fields);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function getExistingValue(key: string): string | null {
    if (!currentData) return null;
    if (key.startsWith("address.")) {
      const sub = key.split(".")[1];
      const addr = (currentData.address ?? {}) as Record<string, unknown>;
      const v = addr[sub];
      return v && typeof v === "string" ? v : null;
    }
    const v = currentData[key];
    return v && typeof v === "string" ? v : null;
  }

  async function handleApply() {
    if (!extracted || !currentData) return;
    setSaving(true);
    setError(null);

    // Build merged data: start from current, apply extracted fields that are new or overridden
    const merged = { ...currentData } as Record<string, unknown>;
    const flatExtracted = flattenFields(extracted);

    for (const { key, value } of flatExtracted) {
      const existing = getExistingValue(key);
      if (!existing || overrides.has(key)) {
        if (key.startsWith("address.")) {
          const sub = key.split(".")[1];
          const addr = (merged.address ?? {}) as Record<string, unknown>;
          merged.address = { ...addr, [sub]: value };
        } else {
          merged[key] = value;
        }
      }
    }

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Save failed. Please try again.");
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const flatExtracted = extracted ? flattenFields(extracted) : [];
  const newFields = flatExtracted.filter(({ key }) => !getExistingValue(key));
  const conflictFields = flatExtracted.filter(({ key }) => !!getExistingValue(key));

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all shadow-sm active:scale-[0.98]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Fill from CV / bio
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickfill-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 id="quickfill-title" className="text-lg font-semibold text-slate-900">
                Fill profile from text
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {!extracted ? (
                <>
                  <p className="text-sm text-slate-500">
                    Paste your CV, LinkedIn About section, or a short bio. We&apos;ll extract your profile details automatically.
                  </p>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your CV or bio here…"
                    rows={10}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      {text.trim().length < 200
                        ? `${200 - text.trim().length} more characters needed`
                        : `${text.trim().length.toLocaleString()} characters`}
                    </p>
                    <button
                      onClick={handleExtract}
                      disabled={text.trim().length < 200 || loading}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {loading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          Extracting…
                        </>
                      ) : "Extract fields"}
                    </button>
                  </div>
                  {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                </>
              ) : saved ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Profile updated!</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Review the extracted values below. New fields will be added automatically. Existing fields are highlighted — tick to override.
                  </p>

                  {newFields.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New fields</p>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        {newFields.map(({ key, label, value }) => (
                          <div key={key} className="flex items-center gap-3 px-4 py-3 bg-emerald-50/40">
                            <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-400">{label}</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {conflictFields.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Already filled — tick to override</p>
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                        {conflictFields.map(({ key, label, value }) => {
                          const existing = getExistingValue(key)!;
                          const willOverride = overrides.has(key);
                          return (
                            <label key={key} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${willOverride ? "bg-amber-50" : "bg-white hover:bg-slate-50"}`}>
                              <input
                                type="checkbox"
                                checked={willOverride}
                                onChange={(e) => {
                                  const next = new Set(overrides);
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                  setOverrides(next);
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-xs text-slate-400">{label}</p>
                                <p className="text-sm text-slate-500 truncate line-through">{existing}</p>
                                <p className="text-sm font-medium text-amber-800 truncate">{value}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => { setExtracted(null); setError(null); }}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={saving || flatExtracted.length === 0}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {saving ? "Saving…" : `Apply ${newFields.length + overrides.size} field${newFields.length + overrides.size !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
