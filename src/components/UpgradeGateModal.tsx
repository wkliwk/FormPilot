"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  /** "limit" = hit monthly upload cap; "feature" = tried to use a Pro-only feature */
  reason: "limit" | "feature";
  featureName?: string; // Only used when reason="feature"
  onClose: () => void;
}

const DISMISS_COOKIE = "fp-upgrade-dismiss";
const DISMISS_DAYS = 30;

function setDismissCookie() {
  const expires = new Date(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${DISMISS_COOKIE}=1; expires=${expires}; path=/; SameSite=Lax`;
}

export function isDismissed(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${DISMISS_COOKIE}=`));
}

export default function UpgradeGateModal({ reason, featureName, onClose }: Props) {
  const [proCount, setProCount] = useState<number | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch social proof count
  useEffect(() => {
    fetch("/api/stats/pro-count")
      .then((r) => r.json())
      .then((d: { proCount: number }) => setProCount(d.proCount))
      .catch(() => null);
  }, []);

  // Focus the close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Escape key closes modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus trap — keep Tab/Shift+Tab inside the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, []);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    const res = await fetch("/api/billing/create-checkout", { method: "POST" });
    const data = (await res.json()) as { url?: string };
    if (data.url) window.location.href = data.url;
    setUpgradeLoading(false);
  }

  function handleRemindLater() {
    setDismissCookie();
    onClose();
  }

  const headline =
    reason === "limit"
      ? "You're out of free forms for this month"
      : `${featureName ?? "This feature"} is Pro-only`;

  const subheadline =
    reason === "limit"
      ? "FormPilot Pro gives you unlimited forms — no limits, no waiting."
      : "Upgrade to Pro to unlock this and every other Pro feature.";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4 animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Pro badge + headline */}
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 mb-3">
            Pro
          </span>
          <h2 id="upgrade-modal-title" className="text-lg font-bold text-slate-900 leading-snug pr-6">
            {headline}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{subheadline}</p>
        </div>

        {/* Feature list */}
        <ul className="space-y-2">
          {["Unlimited forms", "Word & PDF export", "Completion certificates"].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {/* Social proof */}
        {proCount !== null && (
          <p className="text-xs text-slate-400">
            Join <span className="font-semibold text-slate-600">{proCount.toLocaleString()}</span> people already on Pro
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {upgradeLoading ? "Redirecting…" : "Upgrade to Pro — $9/mo"}
          </button>
          <Link
            href="/dashboard#referral"
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-center text-blue-600 hover:text-blue-800 rounded-xl border border-blue-100 hover:bg-blue-50 transition-colors"
          >
            Refer a friend instead
          </Link>
        </div>

        {/* Dismiss — only for limit modals (doesn't suppress Pro-feature gates) */}
        {reason === "limit" && (
          <button
            onClick={handleRemindLater}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
          >
            Remind me next month
          </button>
        )}
      </div>
    </div>
  );
}
