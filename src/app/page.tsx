import Link from "next/link";

function UploadIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="12" y2="12" />
      <line x1="15" y1="15" x2="12" y2="12" />
    </svg>
  );
}

function ExplainIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function AutofillIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const features = [
  {
    title: "Upload Any Form",
    description: "Drag and drop PDF or Word documents. We parse every field automatically -- tax forms, visa applications, government paperwork.",
    icon: UploadIcon,
    color: "blue" as const,
  },
  {
    title: "Plain Language Help",
    description: "Every field explained clearly with examples and common mistakes. No more guessing what 'Adjusted Gross Income' means.",
    icon: ExplainIcon,
    color: "violet" as const,
  },
  {
    title: "Smart Autofill",
    description: "Fill fields from your secure profile with confidence scoring. Review each suggestion before accepting -- you stay in control.",
    icon: AutofillIcon,
    color: "amber" as const,
  },
  {
    title: "Privacy First",
    description: "Your data is encrypted at rest and never shared. Sensitive fields like SSN are stored with AES-256-GCM encryption.",
    icon: ShieldIcon,
    color: "emerald" as const,
  },
];

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    border: "group-hover:border-blue-200",
  },
  violet: {
    bg: "bg-violet-50",
    icon: "text-violet-600",
    border: "group-hover:border-violet-200",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "text-amber-600",
    border: "group-hover:border-amber-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    border: "group-hover:border-emerald-200",
  },
};

const steps = [
  {
    step: "1",
    title: "Upload your form",
    description: "Drop a PDF or Word document -- we handle the rest.",
  },
  {
    step: "2",
    title: "Review field explanations",
    description: "Each field gets a plain-English explanation with examples.",
  },
  {
    step: "3",
    title: "Autofill and export",
    description: "Accept AI suggestions, fill remaining fields, then export.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Try Demo
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-white">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #1e3a8a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
            AI-powered form assistant
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]">
            Fill complex forms
            <br />
            <span className="text-blue-600">with confidence</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Upload any tax, visa, government, or HR form. Get plain-language explanations
            for every field and smart autofill from your secure profile.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Start Filling Forms
              <ArrowRightIcon />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Try a sample form — no signup needed
              <ArrowRightIcon />
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Free to use. No credit card required.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything you need to conquer paperwork
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Stop staring at confusing form fields. FormPilot reads the form, explains what to enter, and fills what it can.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feature) => {
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className={`group bg-white rounded-2xl p-7 border border-slate-100 ${colors.border} shadow-soft hover:shadow-card transition-all duration-200`}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colors.bg} ${colors.icon} mb-4`}>
                  <feature.icon />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Three steps. That is it.
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              From confusing blank form to completed document in minutes.
            </p>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.step}
                className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-soft"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
                  {step.step}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported forms */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Works with any form
        </h2>
        <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
          Upload the forms you already have. We support PDF and Word documents.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {[
            "W-2", "1040", "I-130", "I-485", "DS-160", "W-9",
            "SF-86", "FAFSA", "1099", "W-4", "I-20", "N-400",
          ].map((form) => (
            <span
              key={form}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-soft hover:border-blue-200 hover:text-blue-700 transition-colors cursor-default"
            >
              {form}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to stop guessing on forms?
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
            Upload your first form and see every field explained in plain language.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-all shadow-lg active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRightIcon />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-slate-600 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 hover:text-white transition-all"
            >
              Try a sample form — no signup needed
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </span>
          <p className="text-sm text-slate-400">
            Built to make paperwork painless.
          </p>
        </div>
      </footer>
    </main>
  );
}
