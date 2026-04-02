"use client";

import { useState, useRef } from "react";

interface Props {
  formId: string;
  fieldId: string;
}

export default function FieldQA({ formId, fieldId }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleOpen() {
    setOpen((v) => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 50);
      return !v;
    });
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`/api/forms/${formId}/fields/${fieldId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError("You've asked 10 questions this hour. Try again later.");
        } else {
          setError(data.error ?? "Something went wrong.");
        }
        return;
      }
      setAnswer(data.answer);
      setQuestion("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {open ? "Hide Q&A" : "Ask about this field"}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <form onSubmit={handleAsk} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What if I'm self-employed?"
              maxLength={500}
              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              ) : "Ask"}
            </button>
          </form>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {answer && (
            <div className="text-sm text-slate-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Answer</p>
              <p className="leading-relaxed">{answer}</p>
              <button
                type="button"
                onClick={() => { setAnswer(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                Ask another question
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
