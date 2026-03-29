"use client";

import { useState } from "react";
import type { FormField } from "@/lib/ai/analyze-form";
import DocumentImageViewer from "./DocumentImageViewer";

interface Props {
  formId: string;
  formTitle: string;
  fields: FormField[];
  values: Record<string, string>;
  hasFile: boolean;
  sourceType?: string;
  onConfirmExport: () => void;
  onClose: () => void;
  exporting: boolean;
}

export default function ExportPreviewModal({
  formId,
  formTitle,
  fields,
  values,
  hasFile,
  sourceType,
  onConfirmExport,
  onClose,
  exporting,
}: Props) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const canPreviewDoc = hasFile && (sourceType === "PDF" || sourceType === "IMAGE");
  const filledFields = fields.filter((f) => values[f.id]);
  const emptyRequired = fields.filter((f) => f.required && !values[f.id]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Export preview"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Export Preview</h2>
            <p className="text-xs text-slate-400">{formTitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close preview"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: filled fields list */}
        <div className="w-full lg:w-2/5 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-700">
              {filledFields.length} of {fields.length} fields filled
            </p>
            {emptyRequired.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {emptyRequired.length} required field{emptyRequired.length !== 1 ? "s" : ""} empty
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {fields.map((field) => {
              const val = values[field.id];
              const isActive = activeFieldId === field.id;
              return (
                <button
                  key={field.id}
                  onClick={() => setActiveFieldId(isActive ? null : field.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    isActive
                      ? "border-amber-400 bg-amber-50"
                      : val
                      ? "border-slate-200 bg-white hover:border-slate-300"
                      : "border-dashed border-slate-200 bg-white opacity-60 hover:opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 leading-snug">
                      {field.label}
                      {field.required && (
                        <span className="text-red-400 ml-0.5" aria-label="required">*</span>
                      )}
                    </span>
                    {val ? (
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs text-slate-300 shrink-0">empty</span>
                    )}
                  </div>
                  {val && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{val}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: document preview */}
        <div className="hidden lg:flex flex-col flex-1 overflow-hidden bg-white">
          {canPreviewDoc ? (
            <DocumentImageViewer
              formId={formId}
              fields={fields}
              activeFieldId={activeFieldId}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
              <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="text-sm text-center">Document preview is only available for PDF uploads.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-t border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors underline underline-offset-2"
        >
          Continue Editing
        </button>
        <button
          onClick={onConfirmExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 active:scale-[0.98]"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
