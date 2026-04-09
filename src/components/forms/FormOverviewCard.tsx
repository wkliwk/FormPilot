"use client";

import { useState, useEffect } from "react";

interface OverviewData {
  purpose: string;
  whoFills: string;
  whatYouNeed: string[];
  estimatedMinutes: number;
  warnings: string[];
}

interface Props {
  formId: string;
  initialData?: OverviewData | null;
}

export default function FormOverviewCard({ formId, initialData }: Props) {
  const [data, setData] = useState<OverviewData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [collapsed, setCollapsed] = useState(false);

  // Check localStorage for previous dismissal
  useEffect(() => {
    const key = `overview-seen-${formId}`;
    if (localStorage.getItem(key)) {
      setCollapsed(true);
    }
  }, [formId]);

  // Fetch if no initial data
  useEffect(() => {
    if (initialData) return;
    fetch(`/api/forms/${formId}/overview`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.purpose) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [formId, initialData]);

  function handleStartFilling() {
    localStorage.setItem(`overview-seen-${formId}`, "1");
    setCollapsed(true);
    // Scroll to first field
    const firstField = document.querySelector("[id^='field-']");
    firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 animate-pulse space-y-3">
        <div className="h-4 bg-blue-100 rounded w-48" />
        <div className="h-3 bg-blue-100 rounded w-full" />
        <div className="h-3 bg-blue-100 rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full text-left bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
      >
        <span className="text-sm font-medium text-blue-700">About this form</span>
        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">About this form</p>
          <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">{data.purpose}</p>
        </div>
        <button
          onClick={() => { localStorage.setItem(`overview-seen-${formId}`, "1"); setCollapsed(true); }}
          className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors p-1"
          aria-label="Collapse overview"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-xs text-slate-600">{data.whoFills}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs text-slate-600">~{data.estimatedMinutes} min</span>
        </div>
      </div>

      {data.whatYouNeed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">What you&apos;ll need</p>
          <ul className="space-y-1">
            {data.whatYouNeed.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <svg className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="space-y-1.5">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-amber-700">{w}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleStartFilling}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Start filling
      </button>
    </div>
  );
}
