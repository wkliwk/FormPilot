"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onDismiss: () => void;
}

const STEPS = [
  {
    title: "Build your profile vault",
    description:
      "FormPilot auto-fills your forms using your saved profile data — name, address, SSN, employer, and more. The more complete your profile, the fewer fields you type manually.",
    cta: "Set up profile",
    href: "/dashboard/profile",
    icon: (
      <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    title: "Upload your first form",
    description:
      "Drop any PDF, Word document, or photo. FormPilot parses every field and explains what each one means — no more guessing.",
    cta: "Upload a form",
    href: "/dashboard/upload",
    sampleCta: "Or try a sample W-9",
    sampleHref: "/dashboard/library",
    icon: (
      <svg className="w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: "Watch autofill work",
    description:
      "Open your form and press Autofill. FormPilot matches your profile data to each field with confidence scores — accept, edit, or reject each suggestion.",
    cta: "Go to dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

export default function OnboardingModal({ onDismiss }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  function handleCta() {
    onDismiss();
    router.push(current.href);
  }

  function handleSample() {
    onDismiss();
    router.push(current.sampleHref ?? "/dashboard");
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onDismiss();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-down">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-blue-500" : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-6 pb-4 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center">
            {current.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{current.title}</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{current.description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 space-y-3">
          <button
            onClick={handleCta}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors"
          >
            {current.cta}
          </button>

          {current.sampleCta && (
            <button
              onClick={handleSample}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {current.sampleCta}
            </button>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip for now
            </button>
            {step < STEPS.length - 1 && (
              <button
                onClick={handleNext}
                className="text-xs font-medium text-slate-600 hover:text-slate-800 flex items-center gap-1"
              >
                Next
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
