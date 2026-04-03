import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ formId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { formId } = await params;
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { title: true, status: true },
  });

  if (!form || form.status !== "COMPLETED") {
    return { title: "Certificate Not Found — FormPilot" };
  }

  return {
    title: `${form.title} — Completed with FormPilot`,
    description: `This form was completed using FormPilot, the AI-powered form assistant.`,
  };
}

export default async function CertificateBadgePage({ params }: Props) {
  const { formId } = await params;

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      updatedAt: true,
      // Deliberately NOT selecting: userId, fields, filledData, fileBytes — no personal data
    },
  });

  if (!form || form.status !== "COMPLETED") {
    notFound();
  }

  const verificationId = form.id.slice(-8).toUpperCase();
  const completionDate = form.updatedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const category = form.category ? form.category.replace(/_/g, " ") : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header band */}
          <div className="bg-blue-600 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-white text-2xl font-bold">Form</span>
              <span className="text-blue-200 text-2xl font-light">Pilot</span>
            </div>
            <span className="text-blue-200 text-xs font-semibold uppercase tracking-widest">
              Completion Badge
            </span>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* Check mark */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <p className="text-center text-sm font-semibold text-blue-600 uppercase tracking-widest mb-2">
              Form Completed
            </p>

            <h1 className="text-center text-2xl font-bold text-slate-900 mb-4 leading-tight">
              {form.title}
            </h1>

            {category && (
              <div className="flex justify-center mb-6">
                <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                  {category}
                </span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Completed on</span>
                <span className="text-slate-900 font-semibold">{completionDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Verification ID</span>
                <span className="text-slate-900 font-mono font-semibold">{verificationId}</span>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 italic">
              Filled with confidence using FormPilot
            </p>
          </div>

          {/* Footer CTA */}
          <div className="px-8 pb-8 pt-2">
            <Link
              href="/"
              className="block w-full text-center py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Start your own form &rarr;
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          This page contains no personal data. It only confirms the form was completed.
        </p>
      </div>
    </div>
  );
}
