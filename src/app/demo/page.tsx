import Link from "next/link";
import { generateSampleValue } from "@/lib/sample-data";
import DemoNudgeBanner from "@/components/forms/DemoNudgeBanner";

interface DemoField {
  id: string;
  label: string;
  type: "text" | "date" | "checkbox" | "email" | "tel";
  explanation: string;
  tip: string;
}

const DEMO_FIELDS: DemoField[] = [
  {
    id: "first_name",
    label: "First Name",
    type: "text",
    explanation:
      "Your legal first name as it appears on your government-issued ID. Use the name on your Social Security card — not a nickname.",
    tip: "Use your full legal name, not a preferred name or nickname.",
  },
  {
    id: "last_name",
    label: "Last Name",
    type: "text",
    explanation:
      "Your family name or surname. If you recently changed your name, use your current legal last name that matches your SSN records.",
    tip: "Hyphenated names are fine — write them exactly as they appear on your ID.",
  },
  {
    id: "date_of_birth",
    label: "Date of Birth",
    type: "date",
    explanation:
      "Your birthday in MM/DD/YYYY format. This is used to verify your identity and cannot be left blank on this form.",
    tip: "Double-check the year — a common mistake is typing the current year instead of your birth year.",
  },
  {
    id: "email",
    label: "Email Address",
    type: "email",
    explanation:
      "A valid email address where your employer can send pay stubs, tax documents, and HR communications. Use a personal email you check regularly.",
    tip: "Avoid work email addresses that you might lose access to if you change jobs.",
  },
  {
    id: "phone",
    label: "Phone Number",
    type: "tel",
    explanation:
      "Your primary contact number, including area code. Format: (555) 867-5309. Used for urgent HR or payroll matters only.",
    tip: "Enter digits only — parentheses and dashes are added automatically.",
  },
  {
    id: "job_title",
    label: "Job Title / Position",
    type: "text",
    explanation:
      "Your official title as it appears in your offer letter. This is recorded for HR records and determines which pay scale and benefits tier you fall under.",
    tip: "Use the exact title from your offer letter, even if your day-to-day role is described differently.",
  },
  {
    id: "start_date",
    label: "Employment Start Date",
    type: "date",
    explanation:
      "The first official day of your employment. This is the date used to calculate benefits eligibility, probationary period, and seniority.",
    tip: "If your start date changed, use the revised date from your updated offer letter.",
  },
  {
    id: "full_time",
    label: "Full-Time Employee",
    type: "checkbox",
    explanation:
      "Check this box if you are hired as a full-time employee (typically 35+ hours/week). Part-time employees should leave this unchecked and fill out a separate form.",
    tip: "Your classification affects which benefits package you are eligible for.",
  },
];

function SparkleIcon() {
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
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  );
}

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

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login?from=demo"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Signup nudge banner — dynamic copy after user scrolls into the demo */}
        <DemoNudgeBanner />

        {/* Form header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs font-medium text-violet-700 mb-3">
            <SparkleIcon />
            AI-powered demo
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Simple Job Application Form
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            FormPilot has read this form and pre-filled each field using a
            sample profile. Each field includes a plain-English explanation of
            what to enter and why.
          </p>
        </div>

        {/* Autofill summary badge */}
        <div className="mb-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white shrink-0">
            <CheckIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {DEMO_FIELDS.length} fields autofilled from sample profile
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              In your account, these values come from your saved personal
              profile.
            </p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {DEMO_FIELDS.map((field) => {
            const filledValue = generateSampleValue({
              label: field.label,
              type: field.type,
            });
            const isCheckbox = field.type === "checkbox";

            return (
              <div
                key={field.id}
                className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden"
              >
                {/* Confidence bar */}
                <div className="h-1 bg-emerald-500 w-full" aria-hidden="true" />

                <div className="px-5 py-4">
                  {/* Label row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {field.label}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                      <CheckIcon />
                      Autofilled
                    </span>
                  </div>

                  {/* Value display (read-only) */}
                  {isCheckbox ? (
                    <div
                      className="flex items-center gap-2.5 mb-3"
                      role="group"
                      aria-label={`${field.label} — autofilled: checked`}
                    >
                      <div
                        role="checkbox"
                        aria-checked="true"
                        aria-label={field.label}
                        tabIndex={0}
                        className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0"
                      >
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700">Yes</span>
                    </div>
                  ) : (
                    <div
                      aria-label={`${field.label} — autofilled value: ${filledValue}`}
                      className="w-full px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 text-sm text-slate-800 font-medium mb-3 select-none"
                    >
                      {filledValue}
                    </div>
                  )}

                  {/* AI explanation */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <SparkleIcon />
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        AI Explanation
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {field.explanation}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                      <span className="font-medium text-slate-600">Tip:</span>{" "}
                      {field.tip}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 bg-slate-900 rounded-2xl px-6 py-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-white">
            Ready to fill your own forms?
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Upload any PDF or Word form. FormPilot reads it, explains every
            field, and fills what it can from your profile.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?from=demo"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
            >
              Create your free account
              <ArrowRightIcon />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
