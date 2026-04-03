"use client";

import { useRef, useState } from "react";

interface MemoryRecord {
  id: string;
  fieldType: string;
  label: string;
  value: string;
  confidence: number;
  sourceTitle: string;
  lastUsed: Date;
}

interface Props {
  records: MemoryRecord[];
  grouped: Record<string, MemoryRecord[]>;
  fieldTypeLabels: Record<string, string>;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface EditState {
  id: string;
  draft: string;
}

export default function FormMemoryClient({ records, grouped, fieldTypeLabels }: Props) {
  void records; // used only for initial render; localGrouped drives display
  const [localGrouped, setLocalGrouped] = useState(grouped);
  const [clearing, setClearing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const totalCount = Object.values(localGrouped).reduce((sum, arr) => sum + arr.length, 0);

  function showError(msg: string) {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  }

  function startEdit(record: MemoryRecord) {
    setEdit({ id: record.id, draft: record.value });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEdit(null);
  }

  async function confirmEdit() {
    if (!edit) return;
    const trimmed = edit.draft.trim();
    if (!trimmed) {
      showError("Value cannot be empty");
      return;
    }
    if (trimmed.length > 500) {
      showError("Value must be 500 characters or fewer");
      return;
    }

    const { id } = edit;

    // Optimistic update
    let prevValue = "";
    setLocalGrouped((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((r) => {
          if (r.id === id) {
            prevValue = r.value;
            return { ...r, value: trimmed, confidence: 1.0 };
          }
          return r;
        });
      }
      return next;
    });
    setEdit(null);
    setEditingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save");
      }
      setEditedIds((prev) => new Set(prev).add(id));
    } catch (err) {
      // Revert on error
      setLocalGrouped((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].map((r) => (r.id === id ? { ...r, value: prevValue } : r));
        }
        return next;
      });
      showError(err instanceof Error ? err.message : "Failed to save change");
    } finally {
      setEditingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void confirmEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  async function deleteRecord(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setLocalGrouped((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].filter((r) => r.id !== id);
          if (next[key].length === 0) delete next[key];
        }
        return next;
      });
    } catch {
      showError("Failed to delete memory record");
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function clearAll() {
    if (!window.confirm(`Delete all ${totalCount} memory records? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const res = await fetch("/api/memory", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setLocalGrouped({});
    } catch {
      showError("Failed to clear memory");
    } finally {
      setClearing(false);
    }
  }

  if (totalCount === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        All memory records deleted.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg"
        >
          {errorToast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{totalCount} remembered values</p>
        <button
          onClick={clearAll}
          disabled={clearing}
          className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
        >
          {clearing ? "Clearing…" : "Clear all memory"}
        </button>
      </div>

      {Object.entries(localGrouped).map(([type, typeRecords]) => (
        <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">
              {fieldTypeLabels[type] ?? "Other"}
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {typeRecords.map((record) => {
              const isEditing = edit?.id === record.id;
              const isSaving = editingIds.has(record.id);
              const wasEdited = editedIds.has(record.id);

              return (
                <li key={record.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 uppercase tracking-wide">{record.label}</span>
                      {wasEdited && (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Edited
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          ref={inputRef}
                          type="text"
                          value={edit.draft}
                          onChange={(e) => setEdit({ id: edit.id, draft: e.target.value })}
                          onKeyDown={handleKeyDown}
                          maxLength={500}
                          aria-label={`Edit value for ${record.label}`}
                          className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                        />
                        <button
                          onClick={() => void confirmEdit()}
                          aria-label="Confirm edit"
                          className="shrink-0 p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelEdit}
                          aria-label="Cancel edit"
                          className="shrink-0 p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                        {isSaving ? (
                          <span className="text-slate-400 italic">Saving…</span>
                        ) : (
                          record.value
                        )}
                      </p>
                    )}

                    <p className="text-xs text-slate-400 mt-0.5">
                      From <span className="text-slate-500">{record.sourceTitle}</span> · {formatDate(record.lastUsed)}
                    </p>
                  </div>

                  {!isEditing && (
                    <>
                      <button
                        onClick={() => startEdit(record)}
                        disabled={isSaving || deletingIds.has(record.id)}
                        className="shrink-0 p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                        aria-label={`Edit memory for ${record.label}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void deleteRecord(record.id)}
                        disabled={deletingIds.has(record.id) || isSaving}
                        className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        aria-label={`Delete memory for ${record.label}`}
                      >
                        {deletingIds.has(record.id) ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
