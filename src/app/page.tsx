import Link from "next/link";

// Set to Product Hunt launch URL once live, e.g.:
// "https://www.producthunt.com/posts/formpilot"
const PRODUCT_HUNT_URL: string | null = null;

// Toggle testimonials on/off without a deploy — set SHOW_TESTIMONIALS=true in env
const SHOW_TESTIMONIALS = process.env.SHOW_TESTIMONIALS === "true";

const PRO_PRICE = process.env.NEXT_PUBLIC_PRO_PRICE ?? "$9/mo";

const TESTIMONIALS = [
  {
    quote: "I used to dread my annual immigration renewal. FormPilot explained every field and filled in half of them from my profile. Done in under an hour.",
    name: "Maria S.",
    context: "I-485 adjustment of status",
  },
  {
    quote: "Filing taxes is stressful enough. Having every line explained in plain English — with an example — made a real difference. I actually understood what I was signing.",
    name: "James T.",
    context: "1040 federal tax return",
  },
  {
    quote: "Our HR team sends new hires a stack of forms on day one. FormPilot helped me get through all of them without a single phone call to HR.",
    name: "Priya K.",
    context: "New employee onboarding packet",
  },
];

async function getFormsProcessed(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3300";
    const res = await fetch(`${baseUrl}/api/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.formsProcessed ?? 0;
  } catch {
    return 0;
  }
}

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

export default async function HomePage() {
  const formsProcessed = await getFormsProcessed();

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
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
              AI-powered form assistant
            </div>
            {formsProcessed > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-600 font-medium">
                <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {formsProcessed.toLocaleString()} forms processed
              </div>
            )}
            {PRODUCT_HUNT_URL && (
              <a
                href={PRODUCT_HUNT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full text-sm text-orange-700 font-medium hover:bg-orange-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.8S14.6 8.4 13.604 8.4z" />
                  <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.604 14.4h-3.405V18H7.8V6h5.804a4.2 4.2 0 010 8.4z" clipRule="evenodd" />
                </svg>
                Featured on Product Hunt
              </a>
            )}
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

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Start for free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free plan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col shadow-soft">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Free</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500 text-sm">/mo</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Perfect for occasional paperwork.</p>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
              {[
                "5 form uploads per month",
                "AI field explanations",
                "Autofill from profile",
                "PDF export",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <svg className="w-4 h-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Get started free
            </Link>
          </div>

          {/* Pro plan */}
          <div className="bg-blue-600 rounded-2xl border border-blue-600 p-8 flex flex-col shadow-md relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full">
                Most popular
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">Pro</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{PRO_PRICE.replace("/mo", "").replace("/month", "")}</span>
                <span className="text-blue-200 text-sm">/mo</span>
              </div>
              <p className="mt-2 text-sm text-blue-200">For heavy form-fillers and professionals.</p>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
              {[
                "Unlimited forms",
                "Everything in Free",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white">
                  <svg className="w-4 h-4 shrink-0 text-blue-200" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all shadow-sm active:scale-[0.98]"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials (toggled via SHOW_TESTIMONIALS env var) */}
      {SHOW_TESTIMONIALS && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Early user feedback
            </h2>
            <p className="mt-4 text-lg text-slate-500">What people are saying after using FormPilot on real forms.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft flex flex-col gap-4">
                <svg className="w-6 h-6 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14.017 21v-7.391c0-5.704 3.748-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h3.983v10h-9.966z" />
                </svg>
                <p className="text-sm text-slate-600 leading-relaxed flex-1">{t.quote}</p>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.context}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-900">
              Form<span className="text-blue-600">Pilot</span>
            </span>
            <nav className="flex items-center gap-4">
              <Link href="/demo" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Demo</Link>
              <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Dashboard</Link>
              <Link href="/privacy" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Privacy</Link>
              <Link href="/terms" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">Terms</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {PRODUCT_HUNT_URL && (
              <a
                href={PRODUCT_HUNT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#DA552F] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 12C0 5.373 5.373 0 12 0c6.628 0 12 5.373 12 12s-5.372 12-12 12C5.373 24 0 18.628 0 12zm14.236-4.8H9.6V16.8h1.92v-3.84h2.716c2.134 0 3.564-1.2 3.564-3.24S16.37 7.2 14.236 7.2zm-.144 3.84H11.52V9.12h2.572c1.032 0 1.644.48 1.644 1.464 0 .972-.612 1.464-1.644 1.464z"/></svg>
                Featured on Product Hunt
              </a>
            )}
            <p className="text-sm text-slate-400">Built to make paperwork painless.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
