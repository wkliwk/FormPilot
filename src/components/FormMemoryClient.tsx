"use client";

import { useState } from "react";

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

export default function FormMemoryClient({ records, grouped, fieldTypeLabels }: Props) {
  const [localGrouped, setLocalGrouped] = useState(grouped);
  const [clearing, setClearing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const totalCount = Object.values(localGrouped).reduce((sum, arr) => sum + arr.length, 0);

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
      alert("Failed to delete memory record");
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
      alert("Failed to clear memory");
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
            {typeRecords.map((record) => (
              <li key={record.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">{record.label}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{record.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    From <span className="text-slate-500">{record.sourceTitle}</span> · {formatDate(record.lastUsed)}
                  </p>
                </div>
                <button
                  onClick={() => deleteRecord(record.id)}
                  disabled={deletingIds.has(record.id)}
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
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
