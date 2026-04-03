"use client";

import { useState, useRef, useCallback } from "react";

const NOTE_MAX_LENGTH = 280;

interface Props {
  formId: string;
  fieldId: string;
  initialNote?: string | null;
  /** Called after a successful save/delete so parents can update their notepad indicators. */
  onNoteChange?: (fieldId: string, note: string | null) => void;
}

export default function FieldNote({ formId, fieldId, initialNote, onNoteChange }: Props) {
  const [note, setNote] = useState(initialNote ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saveNote = useCallback(
    async (value: string | null) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/forms/${formId}/notes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldId, note: value }),
        });
        if (res.ok) {
          const saved = value && value.trim() ? value.trim() : null;
          setNote(saved);
          onNoteChange?.(fieldId, saved);
        }
      } catch {
        // silently fail — note UI reverts to last known state
      } finally {
        setSaving(false);
      }
    },
    [formId, fieldId]
  );

  function openEditor() {
    setDraft(note ?? "");
    setEditing(true);
    // Focus textarea on next tick after render
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      setDraft(note ?? "");
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
  }

  function commitEdit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === (note ?? "")) return; // no change
    const newNote = trimmed === "" ? null : trimmed;
    setNote(newNote);
    saveNote(newNote);
  }

  function handleDelete() {
    setNote(null);
    setEditing(false);
    setDraft("");
    saveNote(null);
  }

  // Inline editor
  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Add a private note... (Enter to save, Esc to cancel)"
          className="w-full px-3 py-2 text-sm border border-amber-300 rounded-xl bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-slate-400"
          aria-label="Field note"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 tabular-nums">
            {draft.length} / {NOTE_MAX_LENGTH}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseDown={(e) => {
                // Prevent textarea blur from firing before cancel
                e.preventDefault();
                setEditing(false);
                setDraft(note ?? "");
              }}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                // Prevent textarea blur from firing before save
                e.preventDefault();
                commitEdit();
              }}
              disabled={saving}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Note exists — show callout
  if (note) {
    return (
      <div className="mt-2 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
        {/* Notepad icon */}
        <svg
          className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p className="flex-1 text-amber-800 whitespace-pre-wrap break-words">{note}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={openEditor}
            className="text-amber-600 hover:text-amber-800 transition-colors"
            aria-label="Edit note"
            title="Edit note"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="text-amber-400 hover:text-red-500 transition-colors disabled:opacity-50"
            aria-label="Delete note"
            title="Delete note"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // No note — show "Add note" link
  return (
    <button
      type="button"
      onClick={openEditor}
      className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 transition-colors"
      aria-label="Add a private note to this field"
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <line x1="10" y1="15" x2="14" y2="15" />
      </svg>
      Add note
    </button>
  );
}
