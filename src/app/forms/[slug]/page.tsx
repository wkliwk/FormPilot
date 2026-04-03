import Link from "next/link";
import { notFound } from "next/navigation";
import { SEO_FORMS, getSEOForm } from "@/lib/seo-forms";
import type { Metadata } from "next";

export function generateStaticParams() {
  return SEO_FORMS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const form = getSEOForm(slug);
  if (!form) return {};
  return {
    title: form.metaTitle,
    description: form.metaDescription,
  };
}

export default async function FormSEOPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = getSEOForm(slug);
  if (!form) notFound();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/demo" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Try Demo
            </Link>
            <Link href="/login" className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-slate-600 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-600">{form.title}</span>
        </nav>

        {/* Hero */}
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-4">
          {form.h1}
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          {form.description}
        </p>

        {/* Who needs this */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 mb-8">
          <h2 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-2">Who needs this form?</h2>
          <p className="text-sm text-blue-700 leading-relaxed">{form.whoNeeds}</p>
        </div>

        {/* Pain points */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">Common problems with the {form.title}</h2>
        <div className="space-y-3 mb-10">
          {form.painPoints.map((point, i) => (
            <div key={i} className="flex gap-3 bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{point}</p>
            </div>
          ))}
        </div>

        {/* How FormPilot helps */}
        <div className="bg-slate-900 rounded-2xl px-6 sm:px-8 py-8 text-center mb-10">
          <h2 className="text-xl font-bold text-white mb-3">
            FormPilot makes the {form.title} easy
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-left mt-6 mb-6">
            <div className="bg-slate-800 rounded-xl px-4 py-4">
              <div className="text-blue-400 font-semibold text-sm mb-1">1. Upload</div>
              <p className="text-slate-300 text-xs leading-relaxed">Upload your {form.title} PDF. FormPilot reads every field instantly.</p>
            </div>
            <div className="bg-slate-800 rounded-xl px-4 py-4">
              <div className="text-blue-400 font-semibold text-sm mb-1">2. Understand</div>
              <p className="text-slate-300 text-xs leading-relaxed">Each field gets a plain-English explanation — what it means, where to find the info, common mistakes.</p>
            </div>
            <div className="bg-slate-800 rounded-xl px-4 py-4">
              <div className="text-blue-400 font-semibold text-sm mb-1">3. Fill</div>
              <p className="text-slate-300 text-xs leading-relaxed">Auto-fill from your profile. Review, edit, and export a completed PDF.</p>
            </div>
          </div>
          <Link
            href="/login?from=seo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md"
          >
            {form.ctaText}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <p className="mt-3 text-xs text-slate-400">Free to use. No credit card required.</p>
        </div>

        {/* Other forms */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Other forms FormPilot can help with</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {SEO_FORMS.filter((f) => f.slug !== slug).map((f) => (
            <Link
              key={f.slug}
              href={`/forms/${f.slug}`}
              className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">{f.title}</span>
              <svg className="w-4 h-4 text-slate-400 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
