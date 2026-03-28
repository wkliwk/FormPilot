"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Brand */}
        <Link href="/" className="inline-block text-xl font-bold text-slate-900 mb-12">
          Form<span className="text-blue-600">Pilot</span>
        </Link>

        {/* Error icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-red-50 mx-auto mb-6">
          <svg
            className="w-9 h-9 text-red-500"
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

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-slate-500 leading-relaxed">
          An unexpected error occurred. Try again or return to the home page.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-slate-400 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
