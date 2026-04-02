import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TemplateViewer from "@/components/forms/TemplateViewer";
import UseTemplateButton from "@/components/forms/UseTemplateButton";
import type { FormField } from "@/lib/ai/analyze-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const template = await prisma.formTemplate.findUnique({ where: { slug } });
  if (!template || template.revokedAt) return { title: "Template not found — FormPilot" };
  const description = `Fill the ${template.name} with AI guidance and auto-fill from your profile — powered by FormPilot`;
  const ogImage = "/og-image.png";
  return {
    title: `${template.name} — FormPilot`,
    description,
    openGraph: {
      type: "website",
      title: `${template.name} — FormPilot`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${template.name} — FormPilot`,
      description,
      images: [ogImage],
    },
  };
}

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const template = await prisma.formTemplate.findUnique({ where: { slug } });

  if (!template) {
    notFound();
  }

  if (template.revokedAt) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">This form is no longer available</h1>
          <p className="text-sm text-slate-500">The owner has removed this form. If you need access, please contact them directly.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
            Go to FormPilot
          </Link>
        </div>
      </div>
    );
  }

  const fields = template.fields as unknown as FormField[];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-slate-900 shrink-0">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400">
              Shared template — your data stays private
            </span>
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get FormPilot
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{template.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {fields.length} fields · Shared with you via FormPilot
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-blue-800 flex-1">
            <strong>Use this template to fill your own copy.</strong> FormPilot auto-fills your details from a saved profile — name, address, and more.
          </p>
          <UseTemplateButton templateId={template.id} />
        </div>

        <TemplateViewer fields={fields} />
      </main>

      {/* Made with FormPilot footer */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Made with{" "}
            <Link href="/" className="text-blue-600 hover:underline font-medium">
              FormPilot
            </Link>{" "}
            · AI-powered form assistant
          </p>
          <Link
            href="/login"
            className="text-xs text-blue-600 hover:underline"
          >
            Start filling your own forms →
          </Link>
        </div>
      </footer>
    </div>
  );
}
