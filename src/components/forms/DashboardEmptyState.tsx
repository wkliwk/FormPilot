"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  {
    id: "TAX",
    label: "Tax",
    hint: "W-4, 1040, W-2, 1099 and other tax forms",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    color: "text-blue-600",
    bg: "bg-blue-50",
    hoverBorder: "hover:border-blue-300",
  },
  {
    id: "IMMIGRATION",
    label: "Immigration",
    hint: "DS-160, I-130, I-485, visa applications",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    color: "text-violet-600",
    bg: "bg-violet-50",
    hoverBorder: "hover:border-violet-300",
  },
  {
    id: "HR_EMPLOYMENT",
    label: "HR / Employment",
    hint: "I-9, offer letters, onboarding paperwork",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    hoverBorder: "hover:border-emerald-300",
  },
  {
    id: "HEALTHCARE",
    label: "Healthcare",
    hint: "Insurance, patient intake, prior auth forms",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    color: "text-rose-600",
    bg: "bg-rose-50",
    hoverBorder: "hover:border-rose-300",
  },
  {
    id: "LEGAL",
    label: "Legal",
    hint: "Contracts, affidavits, court filings",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: "text-amber-600",
    bg: "bg-amber-50",
    hoverBorder: "hover:border-amber-300",
  },
  {
    id: "GENERAL",
    label: "Other",
    hint: "Any other form — we handle them all",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: "text-slate-600",
    bg: "bg-slate-100",
    hoverBorder: "hover:border-slate-300",
  },
];

export default function DashboardEmptyState() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrySample() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/forms/sample", { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create sample form");
      }
      const data = await res.json() as { formId: string };
      router.push(`/dashboard/forms/${data.formId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-8 sm:p-10">
      {/* Headline */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-slate-900">
          What kind of form do you need help with?
        </h2>
        <p className="text-slate-500 mt-2 text-sm">
          We&apos;ll explain every field in plain English and auto-fill what we know about you.
        </p>
      </div>

      {/* Category tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => router.push(`/dashboard/upload?category=${cat.id}`)}
            className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border border-slate-200 ${cat.hoverBorder} hover:shadow-sm transition-all text-center group active:scale-[0.98]`}
          >
            <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center ${cat.color} group-hover:scale-105 transition-transform`}>
              {cat.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{cat.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{cat.hint}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Fallback + sample row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-100">
        <button
          onClick={() => router.push("/dashboard/upload")}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2 transition-colors"
        >
          Or upload any form
        </button>
        <span className="hidden sm:inline text-slate-300">·</span>
        <button
          onClick={handleTrySample}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Loading demo…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Try a sample W-4
            </>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
