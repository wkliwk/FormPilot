"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  FILLING: { label: "In Progress", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ANALYZED: { label: "Ready to Fill", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  UPLOADED: { label: "Processing", bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400" },
};

function getStatusStyle(status: string) {
  return statusConfig[status] ?? statusConfig.UPLOADED;
}

function getFileIcon(sourceType: string) {
  if (sourceType === "PDF") {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 text-red-500 shrink-0">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-500 shrink-0">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </div>
  );
}

interface FormCard {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  createdAt: Date;
}

interface Props {
  forms: FormCard[];
}

export default function FormCardList({ forms: initialForms }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setForms((prev) => prev.filter((f) => f.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete form");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {forms.map((form) => {
        const style = getStatusStyle(form.status);
        const isDeleting = deletingId === form.id;
        return (
          <div key={form.id} className="relative group">
            <Link
              href={`/dashboard/forms/${form.id}`}
              className={`flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:border-blue-200 hover:shadow-card transition-all ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
            >
              {getFileIcon(form.sourceType)}

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                  {form.title}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  {form.sourceType}
                  <span className="mx-1.5">&middot;</span>
                  {new Date(form.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${style.bg} ${style.text} shrink-0`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
                {style.label}
              </span>

              <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0 hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>

            <button
              onClick={(e) => handleDelete(e, form.id, form.title)}
              disabled={isDeleting}
              className="absolute right-14 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-10"
              aria-label={`Delete ${form.title}`}
              title="Delete form"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
