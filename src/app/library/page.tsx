import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAllLibraryForms } from "@/lib/library";
import type { Metadata } from "next";
import LibraryGrid from "./LibraryGrid";

export const metadata: Metadata = {
  title: "Form Library — FormPilot",
  description: "Browse common government, tax, immigration, and legal forms. Get AI-powered explanations and autofill assistance.",
};

// Revalidate every 10 minutes for near-fresh community templates
export const revalidate = 600;

const CATEGORY_ORDER = ["Tax", "Immigration", "Legal", "HR / Employment", "Healthcare", "Housing", "General"];

interface LibraryItem {
  slug: string;
  title: string;
  category: string;
  description: string;
  fieldCount: number;
  usedCount: number;
  source: "curated" | "community";
}

export default async function PublicLibraryPage() {
  // Fetch curated forms + community templates in parallel
  const [curatedForms, communityTemplates] = await Promise.all([
    getAllLibraryForms(),
    prisma.formTemplate.findMany({
      where: { visibility: "PUBLIC", revokedAt: null },
      select: {
        slug: true,
        name: true,
        category: true,
        description: true,
        fields: true,
        usedCount: true,
      },
      orderBy: { usedCount: "desc" },
      take: 50,
    }),
  ]);

  const items: LibraryItem[] = [
    // Curated forms
    ...curatedForms.map((f) => ({
      slug: f.slug,
      title: f.title,
      category: f.category,
      description: f.description,
      fieldCount: f.fields.length,
      usedCount: 0,
      source: "curated" as const,
    })),
    // Community templates
    ...communityTemplates
      .filter((t) => t.slug)
      .map((t) => ({
        slug: t.slug!,
        title: t.name,
        category: t.category ?? "General",
        description: t.description ?? "",
        fieldCount: Array.isArray(t.fields) ? (t.fields as unknown[]).length : 0,
        usedCount: t.usedCount,
        source: "community" as const,
      })),
  ];

  // Deduplicate by slug
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });

  // Extract unique categories for filtering
  const categories = CATEGORY_ORDER.filter((c) =>
    uniqueItems.some((item) => item.category === c)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
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

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Form Library</h1>
        <p className="text-slate-600 mt-2 max-w-xl">
          Browse common government, tax, immigration, and legal forms. Each form comes with
          AI-powered field explanations and autofill from your profile.
        </p>
      </div>

      {/* Grid with client-side filter/search */}
      <LibraryGrid items={uniqueItems} categories={categories} />

      {/* Footer CTA */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-slate-600 mb-4">Don&apos;t see your form? Upload any PDF, Word, or image file.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          Get started free
        </Link>
      </div>
    </div>
  );
}
