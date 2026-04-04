"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const FORM_NOTE_MAX = 10000;
const DEBOUNCE_MS = 1000;

interface Props {
  formId: string;
  initialNotes?: string | null;
  onClose: () => void;
  /** Called after every successful save so parent can update hasNotes indicator */
  onNotesChange?: (notes: string) => void;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function FormNotesPanel({ formId, initialNotes, onClose, onNotesChange }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0); // drives "X ago" re-render
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh "saved X ago" every 15s
  useEffect(() => {
    if (!savedAt) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [savedAt]);

  const save = useCallback(
    async (value: string) => {
      setSaving(true);
      try {
        await fetch(`/api/forms/${formId}/form-note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value }),
        });
        setSavedAt(new Date());
        onNotesChange?.(value);
      } catch {
        // silent — user can retry
      } finally {
        setSaving(false);
      }
    },
    [formId, onNotesChange]
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value.slice(0, FORM_NOTE_MAX);
    setNotes(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), DEBOUNCE_MS);
  }

  function handleBlur() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    save(notes);
  }

  // Discard pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="fixed bottom-0 right-0 left-0 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 z-40 flex flex-col bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="text-sm font-semibold text-slate-800">Notes</span>
          <span className="text-xs text-slate-400">(private, not exported)</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors"
          aria-label="Close notes"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Textarea */}
      <div className="p-4">
        {notes === "" && !saving ? (
          <textarea
            value={notes}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={8}
            maxLength={FORM_NOTE_MAX}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-400"
            placeholder="Jot down context, reminders, or anything you want to remember about this form. Only visible to you."
          />
        ) : (
          <textarea
            value={notes}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={8}
            maxLength={FORM_NOTE_MAX}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-400"
          />
        )}

        {/* Footer: char count + save status */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-300 tabular-nums">
            {notes.length.toLocaleString()} / {FORM_NOTE_MAX.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400">
            {saving
              ? "Saving…"
              : savedAt
              ? `Saved ${timeAgo(savedAt)}`
              : initialNotes
              ? "No changes"
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
