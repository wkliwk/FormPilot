"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LibraryFormMeta {
  slug: string;
  title: string;
  category: string;
  description: string;
  estimatedMinutes: number;
  fieldCount: number;
}

const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Tax":            { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  "HR / Employment":{ color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  "Immigration":    { color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  "Healthcare":     { color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
  "Legal":          { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  "Housing":        { color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200" },
};

function categoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] ?? { color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" };
}

export default function LibraryPage() {
  const router = useRouter();
  const [forms, setForms] = useState<LibraryFormMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    fetch("/api/forms/library")
      .then((r) => r.json())
      .then((data: { forms?: LibraryFormMeta[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setForms(data.forms ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load library"))
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(forms.map((f) => f.category)))];
  const filtered = selectedCategory === "All" ? forms : forms.filter((f) => f.category === selectedCategory);

  async function handleStart(slug: string) {
    setStarting(slug);
    setStartError(null);
    try {
      const res = await fetch(`/api/forms/library/${slug}`, { method: "POST" });
      const data = await res.json() as { formId?: string; error?: string; limit?: number; formsUsed?: number };
      if (!res.ok) {
        if (res.status === 403) {
          setStartError(`You've reached your ${data.limit} form limit for this month. Upgrade to Pro for unlimited forms.`);
        } else {
          throw new Error(data.error ?? "Failed to start form");
        }
        setStarting(null);
        return;
      }
      router.push(`/dashboard/forms/${data.formId}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStarting(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Dashboard
          </Link>
          <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm text-slate-600 font-medium">Form Library</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Common Forms</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Start filling a standard form instantly — no upload needed. FormPilot pre-loads the fields with plain-English explanations.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <svg className="w-6 h-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {startError && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                {startError}{" "}
                <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2 text-amber-700 hover:text-amber-900">
                  Upgrade to Pro
                </Link>
              </span>
            </div>
          )}

          {/* Form grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((form) => {
              const style = categoryStyle(form.category);
              const isStarting = starting === form.slug;
              return (
                <div
                  key={form.slug}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 leading-snug">{form.title}</h2>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${style.bg} ${style.color} ${style.border}`}>
                      {form.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed flex-1">{form.description}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        ~{form.estimatedMinutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="8" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" />
                          <line x1="3" y1="12" x2="3.01" y2="12" />
                          <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        {form.fieldCount} fields
                      </span>
                    </div>
                    <button
                      onClick={() => handleStart(form.slug)}
                      disabled={isStarting || !!starting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {isStarting ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          Starting…
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Start filling
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">No forms in this category yet.</p>
          )}
        </>
      )}
    </main>
  );
}
