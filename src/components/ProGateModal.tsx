"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  feature: string;
  benefit: string;
  isPro: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a Pro-gated UI element. For Pro users, renders children unchanged.
 * For free users, intercepts clicks and shows an upgrade modal instead.
 */
export default function ProGateModal({ feature, benefit, isPro, children }: Props) {
  const [open, setOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      {/* Click-trap wrapper — intercepts the click before the child navigates */}
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`${feature} — Pro feature`}
      >
        {children}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Upgrade to access ${feature}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  Pro
                </span>
                <h2 className="text-base font-bold text-slate-900">{feature}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Benefit */}
            <p className="text-sm text-slate-600">{benefit}</p>

            {/* Price + CTA */}
            <div className="flex flex-col gap-2 mt-1">
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
                onClick={() => setOpen(false)}
              >
                Upgrade to Pro — $9/mo
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
