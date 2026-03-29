"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfileBanner() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem("profile-banner-dismissed");
    setIsDismissed(!!dismissed);
  }, []);

  if (isDismissed) {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem("profile-banner-dismissed", "true");
    setIsDismissed(true);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2v2m0-4h-2V7h2v6z" />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Complete your profile</span> to enable autofill on all forms.{" "}
            <Link href="/dashboard/profile" className="underline hover:text-amber-900 font-medium">
              Add profile info
            </Link>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-amber-600 hover:text-amber-700 transition-colors p-1"
          aria-label="Dismiss profile banner"
          title="Dismiss"
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
