"use client";

import { useState } from "react";
import type { FormField } from "@/lib/ai/analyze-form";

interface Props {
  fields: FormField[];
}

export default function TemplateViewer({ fields }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const isExpanded = expandedId === field.id;
        return (
          <div key={field.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : field.id)}
              aria-expanded={isExpanded}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 text-sm">{field.label}</span>
                  {field.required && (
                    <span className="text-xs text-red-500 font-medium">Required</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{field.explanation}</p>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                <div className="pt-3 space-y-2 text-sm text-slate-600">
                  <p>{field.explanation}</p>
                  {field.example && (
                    <p className="text-slate-400">
                      <span className="font-medium text-slate-500">Example: </span>
                      {field.example}
                    </p>
                  )}
                  {field.whereToFind && (
                    <p className="text-slate-400">
                      <span className="font-medium text-slate-500">Where to find: </span>
                      {field.whereToFind}
                    </p>
                  )}
                  {field.commonMistakes && (
                    <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium">Common mistake: </span>
                      {field.commonMistakes}
                    </p>
                  )}
                </div>

                {/* Input area — disabled with a sign-in prompt */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Sign in to fill this field…"
                    disabled
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
