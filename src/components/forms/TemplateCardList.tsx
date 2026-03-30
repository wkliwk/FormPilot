"use client";

import { useState } from "react";

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  TAX: { label: "Tax", bg: "bg-yellow-50", text: "text-yellow-700" },
  IMMIGRATION: { label: "Immigration", bg: "bg-blue-50", text: "text-blue-700" },
  LEGAL: { label: "Legal", bg: "bg-purple-50", text: "text-purple-700" },
  HR_EMPLOYMENT: { label: "HR", bg: "bg-teal-50", text: "text-teal-700" },
  HEALTHCARE: { label: "Healthcare", bg: "bg-rose-50", text: "text-rose-700" },
  GENERAL: { label: "General", bg: "bg-slate-100", text: "text-slate-600" },
};

interface TemplateCard {
  id: string;
  name: string;
  category: string | null;
  slug: string;
  visibility: string;
  usedCount: number;
  fieldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  templates: TemplateCard[];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TemplateCardList({ templates: initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function getShareUrl(slug: string) {
    return `${window.location.origin}/t/${slug}`;
  }

  async function handleCopy(slug: string, id: string) {
    try {
      await navigator.clipboard.writeText(getShareUrl(slug));
    } catch {
      const input = document.createElement("input");
      input.value = getShareUrl(slug);
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete template "${name}"? Anyone with the link will lose access.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete template");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const catConfig = template.category ? categoryConfig[template.category] : null;
        const isDeleting = deletingId === template.id;
        const isCopied = copiedId === template.id;

        return (
          <div
            key={template.id}
            className={`bg-white rounded-xl border border-slate-200 p-4 sm:p-5 transition-opacity ${isDeleting ? "opacity-50" : ""}`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-50 text-violet-500 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 truncate">{template.name}</h3>
                  {catConfig && (
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${catConfig.bg} ${catConfig.text}`}>
                      {catConfig.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{template.fieldCount} fields</span>
                  {template.usedCount > 0 && (
                    <>
                      <span aria-hidden="true">&middot;</span>
                      <span>{template.usedCount} use{template.usedCount !== 1 ? "s" : ""}</span>
                    </>
                  )}
                  <span aria-hidden="true">&middot;</span>
                  <span>Created {formatDate(template.createdAt)}</span>
                </p>

                {/* Share link */}
                {template.slug && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={getShareUrl(template.slug)}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono truncate min-w-0"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopy(template.slug, template.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        isCopied
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      }`}
                      aria-label="Copy share link"
                    >
                      {isCopied ? (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          Copy link
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      disabled={isDeleting}
                      className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-red-100"
                      aria-label={`Delete template ${template.name}`}
                      title="Delete template"
                    >
                      {isDeleting ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
