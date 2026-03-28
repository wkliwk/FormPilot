"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-57px)] bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          This part of the dashboard encountered an error. You can try again or
          go back to the main dashboard.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-slate-400 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
