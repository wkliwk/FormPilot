"use client";

import { useState, useEffect } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  status: SaveStatus;
  savedAt: Date | null;
  onDismissError?: () => void;
}

function computeRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "Saved just now";
  if (diffSec < 60) return `Saved ${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return "Saved 1 min ago";
  if (diffMin < 60) return `Saved ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "Saved 1 hr ago";
  return `Saved ${diffHr} hr ago`;
}

function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState(() => (date ? computeRelativeTime(date) : ""));

  useEffect(() => {
    if (!date) {
      setLabel("");
      return;
    }

    setLabel(computeRelativeTime(date));

    // Tick every 15 seconds to keep the label fresh
    const interval = setInterval(() => setLabel(computeRelativeTime(date)), 15_000);
    return () => clearInterval(interval);
  }, [date]);

  return label;
}

export default function AutoSaveIndicator({ status, savedAt, onDismissError }: Props) {
  const relativeTime = useRelativeTime(savedAt);

  if (status === "idle" && !savedAt) return null;

  if (status === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-slate-400"
        aria-live="polite"
        aria-label="Saving changes"
      >
        <svg
          className="w-3.5 h-3.5 animate-spin shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
        Saving...
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-amber-600"
        aria-live="assertive"
        role="alert"
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Save failed — retrying</span>
        {onDismissError && (
          <button
            type="button"
            onClick={onDismissError}
            className="ml-1 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="Dismiss save error"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    );
  }

  // "saved" or idle-but-has-savedAt
  if (savedAt && relativeTime) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-emerald-600"
        aria-live="polite"
        aria-label={relativeTime}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {relativeTime}
      </span>
    );
  }

  return null;
}
