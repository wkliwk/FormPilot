"use client";

import { useState } from "react";
import type { FormField } from "@/lib/ai/analyze-form";
import DocumentImageViewer from "./DocumentImageViewer";

type ExportFormat = "pdf" | "json" | "clipboard";

interface Props {
  formId: string;
  formTitle: string;
  fields: FormField[];
  values: Record<string, string>;
  hasFile: boolean;
  sourceType?: string;
  onConfirmExport: (format: ExportFormat) => void;
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
  const [copied, setCopied] = useState(false);
  const canFillPDF = hasFile && sourceType === "PDF";
  const defaultFormat: ExportFormat = canFillPDF ? "pdf" : "json";
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);

  const canPreviewDoc = hasFile && (sourceType === "PDF" || sourceType === "IMAGE");
  const filledFields = fields.filter((f) => values[f.id]);
  const emptyRequired = fields.filter((f) => f.required && !values[f.id]);

  const formatOptions: { value: ExportFormat; label: string; description: string; icon: React.ReactNode; disabled?: boolean; disabledReason?: string }[] = [
    {
      value: "pdf",
      label: "Filled PDF",
      description: "Download a PDF with your values written in",
      disabled: !canFillPDF,
      disabledReason: "Only available for PDF uploads",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 13h6M9 17h4" />
        </svg>
      ),
    },
    {
      value: "json",
      label: "Field data (JSON)",
      description: "Download field key-value pairs as JSON",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      value: "clipboard",
      label: "Copy as text",
      description: "Copy all field values to clipboard",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      ),
    },
  ];

  function handleConfirm() {
    onConfirmExport(format);
    if (format === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const confirmLabel = format === "pdf"
    ? "Download PDF"
    : format === "json"
    ? "Download JSON"
    : copied
    ? "Copied!"
    : "Copy to clipboard";

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
        {/* Left: format picker + filled fields list */}
        <div className="w-full lg:w-2/5 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
          {/* Format selector */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-700 mb-2">Export format</p>
            <div className="flex flex-col gap-1.5">
              {formatOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50"
                      : format === opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  title={opt.disabled ? opt.disabledReason : undefined}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={opt.value}
                    checked={format === opt.value}
                    disabled={opt.disabled}
                    onChange={() => setFormat(opt.value)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 shrink-0 ${format === opt.value && !opt.disabled ? "text-blue-600" : "text-slate-400"}`}>
                    {opt.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-800">{opt.label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {opt.disabled ? opt.disabledReason : opt.description}
                    </span>
                  </span>
                  {format === opt.value && !opt.disabled && (
                    <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Fields summary */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
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
              sourceType={sourceType ?? "PDF"}
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
          onClick={handleConfirm}
          disabled={exporting || copied}
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
              {format === "clipboard" ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              {confirmLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
