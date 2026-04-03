import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ shareToken: string }>;
}

async function getSharedForm(shareToken: string) {
  const form = await prisma.form.findUnique({
    where: { shareToken },
    select: { title: true, fields: true, category: true },
  });
  return form;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareToken } = await params;
  const form = await getSharedForm(shareToken);
  if (!form) return { title: "Not Found" };
  return {
    title: `${form.title} — Field Guide | FormPilot`,
    description: `AI-powered field explanations for ${form.title}. Understand every field before you fill it.`,
    openGraph: {
      title: `${form.title} — Field Guide`,
      description: `AI explanations for every field in ${form.title}. Shared via FormPilot.`,
      siteName: "FormPilot",
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { shareToken } = await params;
  const form = await getSharedForm(shareToken);
  if (!form) notFound();

  const fields = form.fields as unknown as FormField[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-medium text-blue-700 mb-3">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            Shared field guide
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{form.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            AI-powered explanations for every field — no sign-up required to read.
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-10">
          {fields.map((field) => (
            <div key={field.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-900 mb-2">{field.label}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{field.explanation}</p>
              {field.example && (
                <p className="mt-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-500">Example:</span> {field.example}
                </p>
              )}
              {field.commonMistakes && (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="font-medium text-slate-500">Common mistake:</span> {field.commonMistakes}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-slate-900 rounded-2xl px-6 py-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-white">Fill this form with FormPilot — it&apos;s free</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Upload any PDF or Word form. FormPilot explains every field and autofills from your saved profile.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md"
          >
            Create your free account
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
