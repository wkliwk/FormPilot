"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface OnboardingChecklistProps {
  hasProfileData: boolean; // profile exists AND has firstName + lastName + email
  formsCount: number;
  hasUsedAutofill: boolean; // any form with status !== 'PENDING'
}

interface Step {
  id: string;
  label: string;
  description: string;
  cta: string;
  href: string;
  done: boolean;
}

const DISMISSED_KEY = "fp_onboarding_dismissed";

export default function OnboardingChecklist({
  hasProfileData,
  formsCount,
  hasUsedAutofill,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [allDoneMessage, setAllDoneMessage] = useState(false);
  const allDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true);
    }
  }, []);

  const steps: Step[] = [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Add your name, email, and address so FormPilot can autofill your forms.",
      cta: "Go to Profile",
      href: "/dashboard/profile",
      done: hasProfileData,
    },
    {
      id: "upload",
      label: "Upload your first form",
      description: "Drop a PDF, Word doc, or photo of any form and we'll parse every field.",
      cta: "Upload Form",
      href: "/dashboard/upload",
      done: formsCount >= 1,
    },
    {
      id: "autofill",
      label: "Use autofill on a form",
      description: "Open a form and click Autofill to see your profile data suggested for each field.",
      cta: "Open a Form",
      href: "/dashboard",
      done: hasUsedAutofill,
    },
  ];

  const allDone = steps.every((s) => s.done);
  const completedCount = steps.filter((s) => s.done).length;

  // Auto-dismiss 3 seconds after all steps complete
  useEffect(() => {
    if (allDone && !dismissed) {
      setAllDoneMessage(true);
      allDoneTimer.current = setTimeout(() => {
        dismiss();
      }, 3000);
    }
    return () => {
      if (allDoneTimer.current) clearTimeout(allDoneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, dismissed]);

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        {allDoneMessage ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">You&apos;re all set! FormPilot is ready to go.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Get started — {completedCount}/{steps.length} steps complete
                </p>
                <div className="hidden sm:flex gap-1">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={`h-1.5 w-8 rounded-full ${step.done ? "bg-blue-500" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={dismiss}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Got it, hide this
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`relative rounded-xl border p-3.5 transition-colors ${
                    step.done
                      ? "border-slate-100 bg-slate-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 mt-0.5 ${
                        step.done ? "bg-emerald-100" : "bg-blue-50"
                      }`}
                    >
                      {step.done ? (
                        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          step.done ? "line-through text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {step.label}
                      </p>
                      {!step.done && (
                        <>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                          <Link
                            href={step.href}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2"
                          >
                            {step.cta}
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
