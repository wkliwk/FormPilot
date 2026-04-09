"use client";

import { useEffect, useRef } from "react";

interface Props {
  onClose: () => void;
  mode: "full" | "guided";
}

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl";

const SHORTCUTS_FULL = [
  { keys: `${mod}+Enter`, desc: "Autofill all fields from profile" },
  { keys: `${mod}+E`, desc: "Export form" },
  { keys: "Enter", desc: "Accept suggestion on focused field" },
  { keys: "Escape", desc: "Reject / clear suggestion on focused field" },
  { keys: "N / ]", desc: "Jump to next unanswered field" },
  { keys: "Alt+N", desc: "Next unanswered field (works in inputs)" },
  { keys: "Alt+P", desc: "Previous unanswered field (works in inputs)" },
  { keys: "Tab / Shift+Tab", desc: "Navigate between fields" },
  { keys: "?", desc: "Toggle this help overlay" },
];

const SHORTCUTS_GUIDED = [
  { keys: `${mod}+Enter`, desc: "Autofill all fields from profile" },
  { keys: "Enter", desc: "Accept suggestion on focused field" },
  { keys: "Escape", desc: "Reject / clear suggestion on focused field" },
  { keys: `\u2191 / \u2193`, desc: "Previous / next section" },
  { keys: "Tab / Shift+Tab", desc: "Navigate between fields" },
  { keys: "?", desc: "Toggle this help overlay" },
];

export default function KeyboardShortcutsHelp({ onClose, mode }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const shortcuts = mode === "guided" ? SHORTCUTS_GUIDED : SHORTCUTS_FULL;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-title" className="font-semibold text-slate-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close keyboard shortcuts help"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2.5 gap-4">
              <span className="text-sm text-slate-600">{s.desc}</span>
              <kbd className="shrink-0 text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center">
          Press <kbd className="font-mono bg-slate-100 px-1 rounded text-slate-600">?</kbd> or <kbd className="font-mono bg-slate-100 px-1 rounded text-slate-600">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
