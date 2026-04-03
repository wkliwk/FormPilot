"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProgressRing from "./ProgressRing";

const MAX_TITLE_LENGTH = 60;

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  FILLING: { label: "In Progress", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ANALYZED: { label: "Ready to Fill", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  UPLOADED: { label: "Processing", bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400" },
};

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  TAX: { label: "Tax", bg: "bg-yellow-50", text: "text-yellow-700" },
  IMMIGRATION: { label: "Immigration", bg: "bg-blue-50", text: "text-blue-700" },
  LEGAL: { label: "Legal", bg: "bg-purple-50", text: "text-purple-700" },
  HR_EMPLOYMENT: { label: "HR", bg: "bg-teal-50", text: "text-teal-700" },
  HEALTHCARE: { label: "Healthcare", bg: "bg-rose-50", text: "text-rose-700" },
  GENERAL: { label: "General", bg: "bg-slate-100", text: "text-slate-600" },
};

function getStatusStyle(status: string) {
  return statusConfig[status] ?? statusConfig.UPLOADED;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  category: string | null;
  fieldCount: number;
  completionPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  forms: FormCard[];
  initialHasMore?: boolean;
}

type SortKey = "updatedAt" | "createdAt" | "title";

export default function FormCardList({ forms: initialForms, initialHasMore = false }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialHasMore && initialForms.length > 0 ? initialForms[initialForms.length - 1].id : null
  );
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/forms?cursor=${nextCursor}&limit=20`);
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json() as { items: FormCard[]; hasMore: boolean; nextCursor: string | null };
      setForms((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      // silently ignore — button stays visible so user can retry
    } finally {
      setLoadingMore(false);
    }
  }

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
      setToast("Form deleted");
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete form");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeletingId(null);
    }
  }

  function startRename(e: React.MouseEvent, form: FormCard) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(form.id);
    setEditTitle(form.title);
    // Focus input on next tick after it mounts
    setTimeout(() => {
      editInputRef.current?.select();
    }, 0);
  }

  async function commitRename(id: string) {
    const trimmed = editTitle.trim().slice(0, MAX_TITLE_LENGTH);
    const original = forms.find((f) => f.id === id)?.title ?? "";
    if (!trimmed || trimmed === original) {
      setEditingId(null);
      return;
    }
    setEditingId(null);
    setRenamingId(id);
    // Optimistic update
    setForms((prev) => prev.map((f) => f.id === id ? { ...f, title: trimmed } : f));
    try {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Rename failed");
    } catch {
      // Roll back on failure
      setForms((prev) => prev.map((f) => f.id === id ? { ...f, title: original } : f));
      setToast("Could not rename form. Please try again.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setRenamingId(null);
    }
  }

  function cancelRename() {
    setEditingId(null);
    setEditTitle("");
  }

  // Derive which statuses and categories are present (for filter pill visibility)
  const presentStatuses = useMemo(
    () => Array.from(new Set(forms.map((f) => f.status))).filter((s) => s in statusConfig),
    [forms]
  );
  const presentCategories = useMemo(
    () => Array.from(new Set(forms.map((f) => f.category).filter(Boolean) as string[])).filter((c) => c in categoryConfig),
    [forms]
  );

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = forms.filter((f) => {
      if (q && !f.title.toLowerCase().includes(q)) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      if (categoryFilter && f.category !== categoryFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "createdAt") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [forms, search, statusFilter, categoryFilter, sortKey]);

  const hasActiveFilter = search.trim() || statusFilter || categoryFilter;

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="space-y-3">
        {/* Search + Sort row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search forms"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="shrink-0 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            aria-label="Sort forms"
          >
            <option value="updatedAt">Last opened</option>
            <option value="createdAt">Date uploaded</option>
            <option value="title">Name A–Z</option>
          </select>
        </div>

        {/* Status + category filter pills */}
        {(presentStatuses.length > 1 || presentCategories.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {presentStatuses.length > 1 && presentStatuses.map((s) => {
              const cfg = statusConfig[s];
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.text} border-current shadow-sm`
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                  aria-pressed={active}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : "bg-slate-300"}`} aria-hidden="true" />
                  {cfg.label}
                </button>
              );
            })}

            {presentCategories.map((c) => {
              const cfg = categoryConfig[c];
              const active = categoryFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(active ? null : c)}
                  className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.text} border-current shadow-sm`
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                  aria-pressed={active}
                >
                  {cfg.label}
                </button>
              );
            })}

            {hasActiveFilter && (
              <button
                onClick={() => { setSearch(""); setStatusFilter(null); setCategoryFilter(null); }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-white text-slate-400 border border-slate-200 hover:text-slate-600 hover:border-slate-300 transition-all"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {filteredForms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">No forms match your search.</p>
          <button
            onClick={() => { setSearch(""); setStatusFilter(null); setCategoryFilter(null); }}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite">
          {filteredForms.map((form) => {
            const style = getStatusStyle(form.status);
            const isDeleting = deletingId === form.id;
            const isEditing = editingId === form.id;
            const isRenaming = renamingId === form.id;
            const catConfig = form.category ? categoryConfig[form.category] : null;
            return (
              <div key={form.id} className="relative group">
                <Link
                  href={`/dashboard/forms/${form.id}`}
                  className={`relative flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:border-blue-200 hover:shadow-card transition-all ${isDeleting ? "opacity-50 pointer-events-none" : ""} ${isEditing ? "pointer-events-none" : ""}`}
                >
                  {getFileIcon(form.sourceType)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          maxLength={MAX_TITLE_LENGTH}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(form.id); }
                            if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                          }}
                          onBlur={() => commitRename(form.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="pointer-events-auto font-semibold text-slate-900 bg-white border border-blue-400 rounded-lg px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 w-full max-w-[300px]"
                          aria-label="Rename form"
                          autoFocus
                        />
                      ) : (
                        <h3
                          className={`font-semibold transition-colors truncate ${isRenaming ? "text-slate-400" : "text-slate-900 group-hover:text-blue-700"}`}
                          title="Click to rename"
                        >
                          {form.title}
                        </h3>
                      )}
                      {catConfig && (
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${catConfig.bg} ${catConfig.text}`}>
                          {catConfig.label}
                        </span>
                      )}
                    </div>

                    {/* Completion ring */}
                    {form.fieldCount > 0 && (
                      <div className="mt-1.5 shrink-0 absolute top-3 right-3">
                        <ProgressRing score={form.completionPercent} size={32} />
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{form.sourceType}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{form.fieldCount} fields</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>edited {formatRelativeTime(form.updatedAt)}</span>
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

                {/* Rename button */}
                <button
                  onClick={(e) => startRename(e, form)}
                  disabled={isDeleting || isEditing}
                  className="absolute right-24 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-10"
                  aria-label={`Rename ${form.title}`}
                  title="Rename form"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
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
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Load more — only show when no active filter (filtered view is already a subset of loaded data) */}
      {hasMore && !hasActiveFilter && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
