"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "upgrade-nudge-dismissed-at";
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Props {
  formsUsed: number;
  limit: number;
}

export default function UpgradeNudgeBanner({ formsUsed, limit }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const dismissedAt = parseInt(raw, 10);
      if (!isNaN(dismissedAt) && Date.now() - dismissedAt < SUPPRESS_MS) {
        return; // still suppressed
      }
    }
    setVisible(true);
  }, []);

  if (!visible || formsUsed < limit - 1) return null;

  const remaining = limit - formsUsed;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200" role="alert">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <svg
          className="w-4 h-4 text-amber-600 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="flex-1 text-sm text-amber-800">
          You&apos;ve used <strong>{formsUsed} of {limit}</strong> free forms this month.{" "}
          {remaining === 1 ? "Only 1 form left — " : ""}
          Upgrade to Pro for unlimited forms.
        </p>
        <Link
          href="/dashboard/billing"
          className="shrink-0 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Upgrade — from $6.58/mo
        </Link>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 text-amber-500 hover:text-amber-700 rounded transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
