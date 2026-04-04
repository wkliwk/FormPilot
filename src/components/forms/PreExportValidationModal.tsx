"use client";

import { useEffect, useRef } from "react";
import { track } from "@vercel/analytics";

export interface PreExportIssue {
  fieldId: string;
  label: string;
  type: "required_empty" | "flagged_blank" | "low_confidence";
}

interface Props {
  issues: PreExportIssue[];
  onReview: () => void;
  onExportAnyway: () => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<PreExportIssue["type"], { label: string; color: string }> = {
  required_empty:  { label: "Required, empty",         color: "text-red-600 bg-red-50 border-red-200" },
  flagged_blank:   { label: "Flagged for review",       color: "text-amber-700 bg-amber-50 border-amber-200" },
  low_confidence:  { label: "Low confidence (unconfirmed)", color: "text-blue-700 bg-blue-50 border-blue-200" },
};

export default function PreExportValidationModal({ issues, onReview, onExportAnyway, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    track("pre_export_validation_shown", { issueCount: issues.length });
    reviewButtonRef.current?.focus();
  }, [issues.length]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const requiredEmptyCount = issues.filter((i) => i.type === "required_empty").length;
  const flaggedBlankCount  = issues.filter((i) => i.type === "flagged_blank").length;
  const lowConfCount       = issues.filter((i) => i.type === "low_confidence").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pre-export-modal-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4 animate-slide-down overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <h2 id="pre-export-modal-title" className="text-base font-bold text-slate-900">
              {issues.length} item{issues.length !== 1 ? "s" : ""} may need attention
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Review these fields before exporting to avoid your form being rejected.
          </p>
        </div>

        {/* Issue summary pills */}
        <div className="flex flex-wrap gap-2">
          {requiredEmptyCount > 0 && (
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-red-50 text-red-600 border-red-200">
              {requiredEmptyCount} required empty
            </span>
          )}
          {flaggedBlankCount > 0 && (
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {flaggedBlankCount} flagged blank
            </span>
          )}
          {lowConfCount > 0 && (
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
              {lowConfCount} low-confidence
            </span>
          )}
        </div>

        {/* Issue list — capped at 10 to keep modal manageable */}
        <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden max-h-52 overflow-y-auto">
          {issues.slice(0, 10).map((issue) => {
            const { label: typeLabel, color } = TYPE_LABELS[issue.type];
            return (
              <div key={`${issue.fieldId}-${issue.type}`} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white">
                <span className="text-sm text-slate-700 truncate">{issue.label}</span>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
                  {typeLabel}
                </span>
              </div>
            );
          })}
          {issues.length > 10 && (
            <div className="px-3 py-2 text-xs text-slate-400 text-center bg-slate-50">
              +{issues.length - 10} more
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            ref={reviewButtonRef}
            onClick={onReview}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            Review fields
          </button>
          <button
            onClick={onExportAnyway}
            className="w-full py-2.5 bg-white text-slate-500 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors"
          >
            Export anyway
          </button>
        </div>
      </div>
    </div>
  );
}
