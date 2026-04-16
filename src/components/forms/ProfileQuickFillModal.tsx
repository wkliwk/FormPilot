"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
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

type ImportMethod = "cv" | "linkedin" | "id_scan";

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

// ── Method config ─────────────────────────────────────────────────────────────
const METHODS: { id: ImportMethod; label: string; icon: React.ReactNode }[] = [
  {
    id: "cv",
    label: "Paste CV / bio",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn URL",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    id: "id_scan",
    label: "Scan ID",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProfileQuickFillModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ImportMethod>("cv");

  // CV paste state
  const [text, setText] = useState("");

  // LinkedIn state
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // ID scan state
  const [idImageBase64, setIdImageBase64] = useState<string | null>(null);
  const [idImageMime, setIdImageMime] = useState("image/jpeg");
  const [idImagePreview, setIdImagePreview] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const idFileRef = useRef<HTMLInputElement>(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [currentData, setCurrentData] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const resetState = useCallback(() => {
    setExtracted(null);
    setError(null);
    setText("");
    setLinkedinUrl("");
    setIdImageBase64(null);
    setIdImagePreview(null);
    setDocumentType(null);
    setSaved(false);
    setOverrides(new Set());
  }, []);

  const openModal = useCallback(async () => {
    resetState();
    setOpen(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json() as { data: Record<string, unknown> | null };
        setCurrentData(data.data ?? {});
      }
    } catch {
      setCurrentData({});
    }
  }, [resetState]);

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

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // ── CV paste extract ──────────────────────────────────────────────────────
  async function handleExtractCV() {
    if (text.trim().length < 200) return;
    setLoading(true); setError(null); setExtracted(null);
    try {
      const res = await fetch("/api/profile/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { fields?: ExtractedFields; error?: string };
      if (!res.ok) { setError(data.error ?? "Extraction failed."); return; }
      const fields = data.fields ?? {};
      if (Object.keys(fields).length === 0) {
        setError("We couldn't extract profile data. Try pasting a more detailed bio or CV.");
        return;
      }
      setExtracted(fields);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  // ── LinkedIn extract ──────────────────────────────────────────────────────
  async function handleExtractLinkedIn() {
    if (!linkedinUrl.includes("linkedin.com/in/")) {
      setError("Enter a valid LinkedIn profile URL (e.g. linkedin.com/in/yourname)");
      return;
    }
    setLoading(true); setError(null); setExtracted(null);
    try {
      const res = await fetch("/api/profile/import-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkedinUrl }),
      });
      const data = await res.json() as { fields?: ExtractedFields; error?: string };
      if (!res.ok) { setError(data.error ?? "Could not import LinkedIn profile."); return; }
      setExtracted(data.fields ?? {});
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  // ── ID scan ───────────────────────────────────────────────────────────────
  function handleIdFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image too large — use a photo under 5MB."); return; }
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) { setError("Use a JPEG, PNG, or WebP photo."); return; }
    setIdImageMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setIdImagePreview(dataUrl);
      setIdImageBase64(dataUrl.split(",")[1]);
      setError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleExtractID() {
    if (!idImageBase64) return;
    setLoading(true); setError(null); setExtracted(null);
    try {
      const res = await fetch("/api/profile/import-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: idImageBase64, mimeType: idImageMime }),
      });
      const data = await res.json() as { fields?: ExtractedFields; documentType?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Could not read ID document."); return; }
      setDocumentType(data.documentType ?? null);
      setExtracted(data.fields ?? {});
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Apply extracted fields ────────────────────────────────────────────────
  async function handleApply() {
    if (!extracted || !currentData) return;
    setSaving(true); setError(null);
    const merged = { ...currentData } as Record<string, unknown>;
    for (const { key, value } of flattenFields(extracted)) {
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
        setError(data.error ?? "Save failed."); return;
      }
      setSaved(true);
      setTimeout(() => { setOpen(false); router.refresh(); }, 1000);
    } catch { setError("Save failed. Please try again."); }
    finally { setSaving(false); }
  }

  const flatExtracted = extracted ? flattenFields(extracted) : [];
  const newFields = flatExtracted.filter(({ key }) => !getExistingValue(key));
  const conflictFields = flatExtracted.filter(({ key }) => !!getExistingValue(key));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all shadow-sm active:scale-[0.98]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Quick Import
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickfill-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h2 id="quickfill-title" className="text-lg font-semibold text-slate-900">Quick Import</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill your profile in seconds</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {saved ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Profile updated!</p>
                </div>
              ) : !extracted ? (
                <>
                  {/* Method tabs */}
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                    {METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setMethod(m.id); setError(null); }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                          method === m.id
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {m.icon}
                        <span className="hidden sm:inline">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* CV paste */}
                  {method === "cv" && (
                    <>
                      <p className="text-sm text-slate-500">
                        Paste your CV, LinkedIn About section, or a short bio. We&apos;ll extract your profile details automatically.
                      </p>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste your CV or bio here…"
                        rows={10}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          {text.trim().length < 200 ? `${200 - text.trim().length} more characters needed` : `${text.trim().length.toLocaleString()} characters`}
                        </p>
                        <button
                          onClick={handleExtractCV}
                          disabled={text.trim().length < 200 || loading}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          {loading ? <Spinner /> : null}
                          {loading ? "Extracting…" : "Extract fields"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* LinkedIn URL */}
                  {method === "linkedin" && (
                    <>
                      <p className="text-sm text-slate-500">
                        Paste your LinkedIn public profile URL. We&apos;ll fetch the page and extract your name, role, employer, and location.
                      </p>
                      <input
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="linkedin.com/in/yourname"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400">
                        Your profile must be set to &quot;Public&quot; in LinkedIn settings. Only name, role, and location are extracted — no account access needed.
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={handleExtractLinkedIn}
                          disabled={!linkedinUrl.includes("linkedin.com/in/") || loading}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          {loading ? <Spinner /> : null}
                          {loading ? "Importing…" : "Import"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* ID scan */}
                  {method === "id_scan" && (
                    <>
                      <p className="text-sm text-slate-500">
                        Take a photo of your driver&apos;s license or passport. We&apos;ll extract your name, date of birth, and address. The image is processed immediately and never stored.
                      </p>

                      <input
                        ref={idFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleIdFileSelect}
                        className="hidden"
                        aria-label="Upload ID photo"
                        capture="environment"
                      />

                      {!idImagePreview ? (
                        <button
                          type="button"
                          onClick={() => idFileRef.current?.click()}
                          className="w-full flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-8 px-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer"
                        >
                          <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                          </svg>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-slate-700">Take photo or upload</p>
                            <p className="text-xs text-slate-400 mt-1">Driver&apos;s license or passport (front)</p>
                          </div>
                        </button>
                      ) : (
                        <div className="relative">
                          <img src={idImagePreview} alt="ID document preview" className="w-full rounded-xl border border-slate-200 object-cover max-h-48" />
                          <button
                            type="button"
                            onClick={() => { setIdImageBase64(null); setIdImagePreview(null); }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-800/70 text-white flex items-center justify-center text-xs hover:bg-slate-900 transition-colors"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <p className="text-xs text-amber-800">ID photo is processed immediately and never stored on our servers.</p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleExtractID}
                          disabled={!idImageBase64 || loading}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          {loading ? <Spinner /> : null}
                          {loading ? "Reading ID…" : "Extract from ID"}
                        </button>
                      </div>
                    </>
                  )}

                  {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                </>
              ) : (
                // ── Review & confirm extracted fields ──
                <>
                  <div>
                    <p className="text-sm text-slate-500">
                      Review the extracted values below. New fields will be added automatically. Existing fields are highlighted — tick to override.
                    </p>
                    {documentType && (
                      <p className="text-xs text-slate-400 mt-1">Document detected: <span className="font-medium text-slate-600">{documentType}</span></p>
                    )}
                  </div>

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
                                  if (e.target.checked) next.add(key); else next.delete(key);
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
                      onClick={() => { setExtracted(null); setError(null); setDocumentType(null); }}
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

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}
