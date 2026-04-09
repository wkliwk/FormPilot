"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { FormField } from "@/lib/ai/analyze-form";
import { validateFieldFormat } from "@/lib/validation/field-rules";
import dynamic from "next/dynamic";

// pdf.js uses DOMMatrix at module-level — must be client-only (no SSR)
const DocumentImageViewer = dynamic(() => import("./DocumentImageViewer"), { ssr: false });

export type ExportFormat = "pdf" | "json" | "docx" | "clipboard" | "email";

interface Props {
  formId: string;
  formTitle: string;
  fields: FormField[];
  values: Record<string, string>;
  hasFile: boolean;
  sourceType?: string;
  isPro?: boolean;
  userEmail?: string;
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
  isPro,
  userEmail,
  onConfirmExport,
  onClose,
  exporting,
}: Props) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const canFillPDF = hasFile && sourceType === "PDF";
  const defaultFormat: ExportFormat = canFillPDF ? "pdf" : "json";
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);

  // Email send state
  const [emailTo, setEmailTo] = useState(userEmail ?? "");
  const [emailSubject, setEmailSubject] = useState(formTitle);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Fetch user email on first email format selection if not provided
  useEffect(() => {
    if (format === "email" && !emailTo && !userEmail) {
      fetch("/api/profile")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const email = data?.data?.email;
          if (email) setEmailTo(email);
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const canPreviewDoc = hasFile && (sourceType === "PDF" || sourceType === "IMAGE");
  const filledFields = fields.filter((f) => values[f.id]);
  const emptyRequired = fields.filter((f) => f.required && !values[f.id]);
  const formatErrors = useMemo(
    () =>
      fields.filter((f) => {
        const v = values[f.id];
        return v && validateFieldFormat(f, v) !== null;
      }),
    [fields, values]
  );

  const formatOptions: { value: ExportFormat; label: string; description: string; icon: React.ReactNode; disabled?: boolean; disabledReason?: string; proOnly?: boolean }[] = [
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
      value: "docx",
      label: "Word (.docx)",
      description: sourceType === "WORD" ? "Structured Word document with all field values" : "Two-column table: Field Name | Value",
      proOnly: true,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
          <line x1="10" y1="9" x2="14" y2="9" />
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
    {
      value: "email" as ExportFormat,
      label: "Send by email",
      description: isPro ? "Email the filled form to anyone" : "Email the form to yourself",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
  ];

  // Focus trap + focus on open + Escape to close
  useEffect(() => {
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const all = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEmailSend() {
    setEmailSending(true);
    setEmailError(null);
    try {
      const res = await fetch(`/api/forms/${formId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject || undefined,
          message: emailMessage || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send email");
      }
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEmailSending(false);
    }
  }

  function handleConfirm() {
    if (format === "email") {
      handleEmailSend();
      return;
    }
    // Pro gate: for docx, if not Pro, call confirm (parent opens ProGateModal)
    onConfirmExport(format);
    if (format === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const confirmLabel = format === "pdf"
    ? "Download PDF"
    : format === "docx"
    ? "Download Word"
    : format === "json"
    ? "Download JSON"
    : format === "email"
    ? emailSent
      ? `Sent to ${emailTo}`
      : emailSending
      ? "Sending..."
      : "Send Email"
    : copied
    ? "Copied!"
    : "Copy to clipboard";

  return (
    <div
      ref={modalRef}
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
              {formatOptions.map((opt) => {
                const isDisabled = opt.disabled || (opt.proOnly && !isPro);
                return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    isDisabled
                      ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50"
                      : format === opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  title={opt.disabled ? opt.disabledReason : opt.proOnly && !isPro ? "Pro plan required" : undefined}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={opt.value}
                    checked={format === opt.value}
                    disabled={isDisabled}
                    onChange={() => !isDisabled && setFormat(opt.value)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 shrink-0 ${format === opt.value && !isDisabled ? "text-blue-600" : "text-slate-400"}`}>
                    {opt.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      {opt.label}
                      {opt.proOnly && !isPro && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Pro</span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {opt.disabled ? opt.disabledReason : opt.description}
                    </span>
                  </span>
                  {format === opt.value && !isDisabled && (
                    <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
                );
              })}
            </div>
          </div>

          {/* Email form — shown when email format is selected */}
          {format === "email" && (
            <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-3">
              <div>
                <label htmlFor="email-to" className="text-xs font-medium text-slate-600 block mb-1">To</label>
                <input
                  id="email-to"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  disabled={!isPro && !!userEmail}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="recipient@example.com"
                />
                {!isPro && userEmail && (
                  <p className="text-xs text-slate-400 mt-1">
                    Free plan: sends to your email only.{" "}
                    <a href="/dashboard/billing" className="text-blue-600 hover:underline">Upgrade to Pro</a>
                    {" "}to send to any address.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email-subject" className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
                <input
                  id="email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Form title"
                />
              </div>
              <div>
                <label htmlFor="email-message" className="text-xs font-medium text-slate-600 block mb-1">
                  Message <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="email-message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value.slice(0, 500))}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Please find my completed form attached."
                />
                <p className="text-xs text-slate-400 mt-0.5 text-right">{emailMessage.length}/500</p>
              </div>
              {emailError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {emailError}
                </div>
              )}
              {emailSent && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  Sent to {emailTo}
                </div>
              )}
            </div>
          )}

          {/* Image-source notice */}
          {sourceType === "IMAGE" && (
            <div className="px-4 py-2.5 border-b border-slate-200 bg-amber-50 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-amber-700 leading-snug">
                This form was uploaded as an image. We&apos;ll generate a filled summary — attach it alongside your original.
              </p>
            </div>
          )}

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
            {formatErrors.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {formatErrors.length} field{formatErrors.length !== 1 ? "s have" : " has"} a possible format issue
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {fields.map((field) => {
              const val = values[field.id];
              const isActive = activeFieldId === field.id;
              const formatErr = val ? validateFieldFormat(field, val) : null;
              return (
                <button
                  key={field.id}
                  onClick={() => setActiveFieldId(isActive ? null : field.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    isActive
                      ? "border-amber-400 bg-amber-50"
                      : formatErr
                      ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
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
                    {formatErr ? (
                      <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-label="format issue">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    ) : val ? (
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs text-slate-300 shrink-0">empty</span>
                    )}
                  </div>
                  {val && (
                    <p className={`text-xs mt-0.5 truncate ${formatErr ? "text-amber-700" : "text-slate-500"}`}>{val}</p>
                  )}
                  {formatErr && (
                    <p className="text-xs text-amber-600 mt-0.5">{formatErr}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: document preview */}
        <div className="hidden lg:flex flex-col flex-1 overflow-hidden bg-white">
          {canPreviewDoc ? (
            <>
              <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center gap-1.5 shrink-0">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  This preview shows the original form layout. Your filled answers will be included in the downloaded file.
                </span>
              </div>
              <DocumentImageViewer
                formId={formId}
                sourceType={sourceType ?? "PDF"}
                fields={fields}
                activeFieldId={activeFieldId}
                liveValues={values}
              />
            </>
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
          disabled={exporting || copied || emailSending || emailSent || (format === "email" && !emailTo)}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 active:scale-[0.98] ${
            emailSent ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
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
