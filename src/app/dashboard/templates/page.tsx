import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TemplateCardList from "@/components/forms/TemplateCardList";
import type { FormField } from "@/lib/ai/analyze-form";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const templates = await prisma.formTemplate.findMany({
    where: { userId: session.user.id!, revokedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      slug: true,
      visibility: true,
      usedCount: true,
      createdAt: true,
      updatedAt: true,
      fields: true,
    },
  });

  const templateData = templates.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category ?? null,
    slug: t.slug ?? "",
    visibility: t.visibility,
    usedCount: t.usedCount,
    fieldCount: (t.fields as unknown as FormField[]).length,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          {templates.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to My Forms
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-12 sm:p-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">No templates yet</h2>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto text-sm">
            Open a completed form and click &ldquo;Share as Template&rdquo; to create a shareable link — your personal data is never included.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98]"
          >
            Go to My Forms
          </Link>
        </div>
      ) : (
        <TemplateCardList templates={templateData} />
      )}
    </main>
  );
}
