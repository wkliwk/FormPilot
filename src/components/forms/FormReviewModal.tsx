"use client";

import React, { useEffect, useRef } from "react";
import type { ReviewResult, ReviewCheckStatus } from "@/app/api/forms/[id]/review/route";

// Re-export type so FormViewer can import from one place
export type { ReviewResult };

interface Props {
  result: ReviewResult;
  onDownloadAnyway: () => void;
  onFixIssues: (firstFailId: string | null) => void;
  onClose: () => void;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ready:   { label: "Looks good to submit",   bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  review:  { label: "Review recommended",      bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
  issues:  { label: "Issues found",            bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500"     },
};

const CHECK_ICONS: Record<ReviewCheckStatus, React.ReactElement> = {
  pass: (
    <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  fail: (
    <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

const CHECK_LABEL_COLORS: Record<ReviewCheckStatus, string> = {
  pass: "text-slate-700",
  warn: "text-amber-800",
  fail: "text-red-800",
};

export default function FormReviewModal({ result, onDownloadAnyway, onFixIssues, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  const statusCfg = STATUS_CONFIG[result.status];
  const firstFailId = result.checks.find((c) => c.status === "fail" || c.status === "warn")?.id ?? null;
  const hasIssues = result.status !== "ready";

  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col gap-5 animate-slide-down overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <h2 id="review-modal-title" className="text-base font-bold text-slate-900 mb-1 pr-6">
            FormPilot Review
          </h2>
          <p className="text-sm text-slate-500">AI readiness check before you submit</p>
        </div>

        {/* Overall status badge */}
        <div className={`mx-6 flex items-center gap-3 rounded-xl border px-4 py-3 ${statusCfg.bg} ${statusCfg.border}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusCfg.dot}`} aria-hidden="true" />
          <span className={`text-sm font-semibold ${statusCfg.text}`}>{statusCfg.label}</span>
        </div>

        {/* Completeness bar */}
        <div className="px-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-500">Completeness</span>
            <span className="text-xs font-bold text-slate-700">{result.score}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                result.score >= 80 ? "bg-emerald-500" : result.score >= 50 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${result.score}%` }}
              role="progressbar"
              aria-valuenow={result.score}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Check results */}
        <div className="px-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Checks</p>
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {result.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-3 px-3 py-2.5 bg-white">
                <span className="mt-0.5">{CHECK_ICONS[check.status]}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${CHECK_LABEL_COLORS[check.status]}`}>
                    {check.label}
                  </p>
                  {check.detail && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{check.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submission notes */}
        {result.submissionNotes.length > 0 && (
          <div className="px-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Submission Notes</p>
            <ul className="space-y-1.5">
              {result.submissionNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {hasIssues ? (
            <>
              <button
                ref={primaryBtnRef}
                onClick={() => onFixIssues(firstFailId)}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
              >
                Fix issues
              </button>
              <button
                onClick={onDownloadAnyway}
                className="w-full py-2.5 bg-white text-slate-500 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors"
              >
                Download anyway
              </button>
            </>
          ) : (
            <>
              <button
                ref={primaryBtnRef}
                onClick={onDownloadAnyway}
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              >
                Download &amp; submit
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-white text-slate-500 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
