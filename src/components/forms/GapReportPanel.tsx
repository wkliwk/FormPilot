"use client";

import Link from "next/link";

export interface ProfileGap {
  formField: string;
  profileKey: string;
  profileLabel: string;
}

interface GapReportPanelProps {
  gaps: ProfileGap[];
  formId: string;
  onDismiss: () => void;
}

export default function GapReportPanel({ gaps, formId, onDismiss }: GapReportPanelProps) {
  if (gaps.length === 0) return null;

  function handleDismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(`gapReportDismissed:${formId}`, "1");
    }
    onDismiss();
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm font-semibold text-amber-800">
            {gaps.length} field{gaps.length !== 1 ? "s" : ""} couldn&apos;t be autofilled — add missing info to your profile
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-xs text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>

      <ul className="space-y-1 mb-3">
        {gaps.map((gap) => (
          <li key={gap.profileKey} className="text-xs text-amber-700">
            <span className="font-medium">{gap.formField}</span>
            {" — needs "}
            <span className="font-medium">{gap.profileLabel}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/profile"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
      >
        Go to Profile
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}
