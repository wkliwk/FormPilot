"use client";

import { useEffect, useRef, useState } from "react";

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

/*
 * Feature comparison table — Free vs Pro (6 differentiating rows).
 * Update this list whenever plan features change.
 */
const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Forms per month",           free: "5",        pro: "Unlimited" },
  { label: "AI field explanations",     free: true,       pro: true },
  { label: "Profile autofill",          free: true,       pro: true },
  { label: "Word (.docx) upload",       free: false,      pro: true },
  { label: "Batch fill (up to 10)",     free: false,      pro: true },
  { label: "Completion certificates",   free: false,      pro: true },
  { label: "Form templates",            free: false,      pro: true },
  { label: "Priority AI processing",    free: false,      pro: true },
];

// TODO: replace with real testimonials before Product Hunt launch
const TESTIMONIALS = [
  { quote: "Saved me an hour on my visa application. Every field explained.", author: "— Beta user, UK" },
  { quote: "Finally got my W-2 done in under 10 minutes. Worth every penny.", author: "— Beta user, US" },
];

type PlanChoice = "monthly" | "annual";

export default function UpgradeGateModal({ reason, featureName, onClose }: Props) {
  const [proCount, setProCount] = useState<number | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [plan, setPlan] = useState<PlanChoice>("annual");
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
    const res = await fetch(`/api/billing/create-checkout?plan=${plan}`, { method: "POST" });
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
      ? "Unlock the full FormPilot experience"
      : `${featureName ?? "This feature"} is Pro-only`;

  const subheadline =
    reason === "limit"
      ? "You've used your free forms for this month. Upgrade to continue."
      : "Upgrade to Pro to unlock this and every other Pro feature.";

  const ctaLabel = upgradeLoading
    ? "Redirecting…"
    : plan === "annual"
    ? "Start Pro — $79/year"
    : "Start Pro — $9/month";

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
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 animate-slide-down overflow-y-auto max-h-[90vh]"
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

        {/* Plan toggle */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setPlan("monthly")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              plan === "monthly"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Monthly <span className="text-slate-400 font-normal">$9/mo</span>
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              plan === "annual"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Annual
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              Save 27%
            </span>
          </button>
        </div>

        {plan === "annual" && (
          <p className="text-xs text-slate-500 -mt-3 text-center">$79/year · $6.58/mo · cancel anytime</p>
        )}

        {/* Feature comparison table */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 px-3 py-2">
            <span>Feature</span>
            <span className="text-center w-12">Free</span>
            <span className="text-center w-12 text-violet-700">Pro</span>
          </div>
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-[1fr_auto_auto] items-center px-3 py-2.5 text-sm ${
                i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
              }`}
            >
              <span className="text-slate-700">{f.label}</span>
              <span className="text-center w-12">
                {typeof f.free === "boolean" ? (
                  f.free ? (
                    <svg className="w-4 h-4 text-emerald-500 mx-auto" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )
                ) : (
                  <span className="text-slate-600 text-xs font-medium">{f.free}</span>
                )}
              </span>
              <span className="text-center w-12">
                {typeof f.pro === "boolean" ? (
                  f.pro ? (
                    <svg className="w-4 h-4 text-violet-600 mx-auto" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )
                ) : (
                  <span className="text-violet-700 text-xs font-semibold">{f.pro}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonials — TODO: replace placeholder quotes with real ones before launch */}
        <div className="space-y-2">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.author} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-700 italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <footer className="text-xs text-slate-400 mt-1">{t.author}</footer>
            </blockquote>
          ))}
        </div>

        {/* Social proof */}
        {proCount !== null && proCount > 0 && (
          <p className="text-xs text-slate-400 text-center -mt-2">
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
            {ctaLabel}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-xl transition-colors"
          >
            Maybe later
          </button>
        </div>

        {/* Dismiss — only for limit modals (doesn't suppress Pro-feature gates) */}
        {reason === "limit" && (
          <button
            onClick={handleRemindLater}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors text-center -mt-3"
          >
            Remind me next month
          </button>
        )}
      </div>
    </div>
  );
}
