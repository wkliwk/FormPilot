"use client";

import { useState } from "react";

interface Correction {
  id: string;
  label: string;
  value: string;
  lastUsed: Date | string;
}

interface Props {
  initialCorrections: Correction[];
}

export default function SavedCorrections({ initialCorrections }: Props) {
  const [corrections, setCorrections] = useState<Correction[]>(initialCorrections);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/corrections/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCorrections((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (corrections.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Saved Corrections</h2>
        <p className="text-sm text-slate-500 mt-1">
          Corrections you&apos;ve saved from editing AI-autofilled fields. These are used as preferences when autofilling future forms.
        </p>
      </div>

      <div className="space-y-2">
        {corrections.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-sm text-slate-900 truncate mt-0.5">{c.value}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400 hidden sm:block">
                {new Date(c.lastUsed).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                className="text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                aria-label={`Delete correction for ${c.label}`}
              >
                {deletingId === c.id ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
