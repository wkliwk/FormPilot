"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function ArrowRightIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function DemoNudgeBanner() {
  const [hasEngaged, setHasEngaged] = useState(false);

  useEffect(() => {
    function onScroll() {
      if (window.scrollY > 260) setHasEngaged(true);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-blue-600 rounded-2xl px-5 py-4 shadow-md">
      <div>
        {hasEngaged ? (
          <>
            <p className="text-white font-semibold text-sm">
              Your real profile fills these in automatically.
            </p>
            <p className="text-blue-100 text-xs mt-0.5">
              Create a free account to upload your own forms — FormPilot reads and fills them instantly.
            </p>
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-sm">
              This is a live demo — no account needed.
            </p>
            <p className="text-blue-100 text-xs mt-0.5">
              Sign up to upload your own forms and save your profile for instant autofill.
            </p>
          </>
        )}
      </div>
      <Link
        href="/login?from=demo"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
      >
        {hasEngaged ? "Create free account" : "Sign up free"}
        <ArrowRightIcon />
      </Link>
    </div>
  );
}
