"use client";

import { useEffect, useRef } from "react";

export interface SavedCorrection {
  fieldId: string;
  fieldLabel: string;
  originalValue: string;
  correctedValue: string;
  profileUpdated: boolean;
}

interface Props {
  corrections: SavedCorrection[];
  onExport: () => void;
  onClose: () => void;
}

export default function CorrectionsReviewModal({ corrections, onExport, onClose }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const profileUpdatedCount = corrections.filter((c) => c.profileUpdated).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="corrections-modal-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col gap-4 animate-slide-down overflow-y-auto max-h-[90vh]"
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

          <div className="flex items-center gap-2 mb-1 pr-6">
            <span className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19H4v-3L16.5 3.5z"/>
              </svg>
            </span>
            <h2 id="corrections-modal-title" className="text-base font-bold text-slate-900">
              Your corrections
            </h2>
          </div>
          <p className="text-sm text-slate-500 pl-9">
            You updated {corrections.length} autofilled field{corrections.length !== 1 ? "s" : ""} in this session.
            {profileUpdatedCount > 0 && (
              <span className="text-emerald-700 font-medium"> {profileUpdatedCount} saved to your profile.</span>
            )}
          </p>
        </div>

        {/* Corrections list */}
        <div className="px-6">
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {corrections.map((c) => (
              <div key={c.fieldId} className="px-3 py-3 bg-white">
                <p className="text-xs font-semibold text-slate-500 mb-1">{c.fieldLabel}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through truncate max-w-[120px]">{c.originalValue || "—"}</span>
                  <svg className="w-3 h-3 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                  <span className="text-xs font-medium text-slate-700 truncate">{c.correctedValue}</span>
                  {c.profileUpdated && (
                    <span className="ml-auto shrink-0 text-xs text-emerald-600 font-medium">Profile updated</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            ref={btnRef}
            onClick={onExport}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            Looks good — export
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Go back and review
          </button>
        </div>
      </div>
    </div>
  );
}
