"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SharedField {
  id: string;
  label: string;
  type: string;
  value: string;
  required: boolean;
  explanation: string;
  example: string;
  locked: boolean;
}

export default function ShareFillPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<SharedField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/share-packet/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "This link is no longer valid.");
          return;
        }
        setTitle(data.title);
        setFields(data.fields);
        const initial: Record<string, string> = {};
        for (const f of data.fields) {
          initial[f.id] = f.value ?? "";
        }
        setValues(initial);
      })
      .catch(() => setError("Failed to load form."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    // Only submit values for unlocked fields
    const openValues: Record<string, string> = {};
    for (const f of fields) {
      if (!f.locked) {
        openValues[f.id] = values[f.id] ?? "";
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/share-packet/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: openValues }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">Loading form...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 max-w-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-red-50 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-slate-700">{error}</p>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Go to FormPilot
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 max-w-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Form submitted</p>
            <p className="text-sm text-slate-500 mt-1">Your responses have been saved. The sender will be notified.</p>
          </div>
          <Link href="/" className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium">
            Try FormPilot for your own forms
          </Link>
        </div>
      </div>
    );
  }

  const openFields = fields.filter((f) => !f.locked);
  const lockedFields = fields.filter((f) => f.locked);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <span className="text-xs text-slate-400">Shared form</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Please review the pre-filled fields and complete the remaining {openFields.length} field{openFields.length !== 1 ? "s" : ""}.
          </p>
        </div>

        {/* Locked (pre-filled) fields */}
        {lockedFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pre-filled (read only)</p>
            <div className="space-y-2">
              {lockedFields.map((f) => (
                <div key={f.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">{f.label}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{values[f.id] || <span className="italic text-slate-300">Empty</span>}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open fields — recipient fills these */}
        {openFields.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Your fields to complete</p>
            {openFields.map((f) => (
              <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <label htmlFor={`fill-${f.id}`} className="text-sm font-semibold text-slate-900">
                  {f.label}
                  {f.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {f.explanation && (
                  <p className="text-xs text-slate-500">{f.explanation}</p>
                )}
                <input
                  id={`fill-${f.id}`}
                  type={f.type === "date" ? "date" : "text"}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  placeholder={f.example || undefined}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit responses"}
        </button>
      </div>
    </div>
  );
}
