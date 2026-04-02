"use client";

import { useState } from "react";
import type { FormField } from "@/lib/ai/analyze-form";
import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/constants";

interface Props {
  fields: FormField[];
  values: Record<string, string>;
  onUpdateValue: (fieldId: string, value: string) => void;
  onConfirmExport: () => void;
  onClose: () => void;
  exporting: boolean;
}

function confidenceBadge(confidence: number): { label: string; className: string } {
  const pct = Math.round(confidence * 100);
  if (confidence < 0.5) {
    return { label: `${pct}% confident`, className: "bg-red-100 text-red-700" };
  }
  return { label: `${pct}% confident`, className: "bg-amber-100 text-amber-700" };
}

export default function ConfidenceReviewPanel({
  fields,
  values,
  onUpdateValue,
  onConfirmExport,
  onClose,
  exporting,
}: Props) {
  const uncertainFields = fields.filter(
    (f) => f.confidence !== undefined && f.confidence < CONFIDENCE_REVIEW_THRESHOLD && values[f.id] !== undefined
  );

  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of uncertainFields) {
      init[f.id] = values[f.id] ?? "";
    }
    return init;
  });

  function handleEdit(fieldId: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [fieldId]: value }));
    // Editing the value counts as reviewing it
    setReviewed((prev) => new Set([...prev, fieldId]));
    onUpdateValue(fieldId, value);
  }

  function handleApprove(fieldId: string) {
    setReviewed((prev) => new Set([...prev, fieldId]));
  }

  const allReviewed = uncertainFields.every((f) => reviewed.has(f.id));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Review uncertain fields"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 shrink-0">
            <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Review uncertain fields</h2>
            <p className="text-xs text-slate-400">
              {uncertainFields.length} field{uncertainFields.length !== 1 ? "s" : ""} below {Math.round(CONFIDENCE_REVIEW_THRESHOLD * 100)}% confidence
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close review panel"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uncertainFields.length > 0 ? (reviewed.size / uncertainFields.length) * 100 : 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums shrink-0">
            {reviewed.size}/{uncertainFields.length} reviewed
          </span>
        </div>
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {uncertainFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">All fields are high-confidence. Ready to export.</p>
          </div>
        ) : (
          uncertainFields.map((field) => {
            const isReviewed = reviewed.has(field.id);
            const badge = confidenceBadge(field.confidence!);
            return (
              <div
                key={field.id}
                className={`rounded-xl border p-4 transition-all ${
                  isReviewed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5" aria-label="required">*</span>}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  {isReviewed && (
                    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <input
                  type="text"
                  value={localValues[field.id] ?? ""}
                  onChange={(e) => handleEdit(field.id, e.target.value)}
                  placeholder="Enter value…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  aria-label={`Edit value for ${field.label}`}
                />

                {!isReviewed && (
                  <button
                    onClick={() => handleApprove(field.id)}
                    className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Looks good
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-t border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors underline underline-offset-2"
        >
          Continue editing
        </button>
        <button
          onClick={onConfirmExport}
          disabled={!allReviewed || exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 active:scale-[0.98]"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Exporting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {allReviewed ? "Export PDF" : `Review all ${uncertainFields.length - reviewed.size} remaining`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
