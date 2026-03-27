"use client";

import { useState, useCallback, useRef } from "react";
import type { FormField, FieldState } from "@/lib/ai/analyze-form";
import type { ValidationResult } from "@/lib/validation/validate-form";
import { validateForm } from "@/lib/validation/validate-form";

interface FormRecord {
  id: string;
  title: string;
  status: string;
  fields: unknown;
}

interface Props {
  form: FormRecord;
  hasProfile: boolean;
}

// -- helpers --

function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const tierConfig = {
  high: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
    border: "border-emerald-200",
    inputBg: "bg-emerald-50/50",
    label: "High match",
  },
  medium: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
    border: "border-amber-200",
    inputBg: "bg-amber-50/50",
    label: "Partial match",
  },
  low: {
    badge: "bg-red-50 text-red-600 border-red-200",
    bar: "bg-red-500",
    border: "border-red-200",
    inputBg: "bg-red-50/50",
    label: "Low match",
  },
} as const;

// -- component --

export default function FormViewer({ form, hasProfile }: Props) {
  const initialFields = form.fields as FormField[];

  const [fields] = useState<FormField[]>(initialFields);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      initialFields.filter((f) => f.value).map((f) => [f.id, f.value!])
    )
  );
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(
    Object.fromEntries(
      initialFields.filter((f) => f.fieldState).map((f) => [f.id, f.fieldState!])
    )
  );
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
  const [autofilling, setAutofilling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showForceExportDialog, setShowForceExportDialog] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- persistence --

  const scheduleSave = useCallback(
    (newValues: Record<string, string>, newStates: Record<string, FieldState>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = setTimeout(async () => {
        try {
          const allFieldIds = new Set([
            ...Object.keys(newValues),
            ...Object.keys(newStates),
          ]);
          const fieldUpdates = Array.from(allFieldIds).map((id) => ({
            id,
            ...(id in newValues ? { value: newValues[id] } : {}),
            ...(id in newStates ? { fieldState: newStates[id] } : {}),
          }));
          await fetch(`/api/forms/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: fieldUpdates, status: "FILLING" }),
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }, 800);
    },
    [form.id]
  );

  // -- field actions --

  function handleValueChange(fieldId: string, value: string) {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);
    scheduleSave(newValues, fieldStates);
  }

  function handleAccept(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "accepted" as FieldState };
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function handleReject(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "rejected" as FieldState };
    const newValues = { ...values };
    delete newValues[fieldId];
    setValues(newValues);
    setFieldStates(newStates);
    scheduleSave(newValues, newStates);
  }

  function handleUndoReject(fieldId: string) {
    const newStates = { ...fieldStates };
    delete newStates[fieldId];
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function handleUnlock(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "pending" as FieldState };
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function handleAcceptAllHigh() {
    const newStates = { ...fieldStates };
    for (const field of fields) {
      if (
        field.confidence !== undefined &&
        field.confidence > 0.8 &&
        values[field.id] &&
        fieldStates[field.id] !== "rejected"
      ) {
        newStates[field.id] = "accepted";
      }
    }
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function toggleExplanation(fieldId: string) {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }

  // -- autofill --

  async function handleAutofill() {
    setAutofilling(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/autofill`, { method: "POST" });
      if (!res.ok) throw new Error("Autofill failed");
      const data = await res.json();
      const newFields: FormField[] = data.fields;
      const newValues = Object.fromEntries(
        newFields.filter((f) => f.value).map((f) => [f.id, f.value!])
      );
      const newStates: Record<string, FieldState> = { ...fieldStates };
      for (const f of newFields) {
        if (f.value && !newStates[f.id]) {
          newStates[f.id] = "pending";
        }
      }
      setValues(newValues);
      setFieldStates(newStates);
      scheduleSave(newValues, newStates);
    } finally {
      setAutofilling(false);
    }
  }

  // -- validation --

  function handleValidate() {
    const result = validateForm(fields, values, fieldStates as Record<string, string>);
    setValidation(result);
  }

  // -- export --

  async function doExport(force = false) {
    setExporting(true);
    setShowForceExportDialog(false);
    try {
      const url = force ? `/api/forms/${form.id}/export?force=true` : `/api/forms/${form.id}/export`;
      const res = await fetch(url);

      if (res.status === 422) {
        // Server-side validation failed — show force dialog
        const data = await res.json();
        setValidation(data.validation);
        setShowForceExportDialog(true);
        return;
      }

      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        "form_filled.json";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setExporting(false);
    }
  }

  async function handleExport() {
    // Run client-side validation first for instant feedback
    const result = validateForm(fields, values, fieldStates as Record<string, string>);
    setValidation(result);

    if (!result.valid) {
      setShowForceExportDialog(true);
      return;
    }

    await doExport();
  }

  // -- derived --

  const filledCount = fields.filter((f) => values[f.id]).length;
  const acceptedCount = fields.filter((f) => fieldStates[f.id] === "accepted").length;
  const progress = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  // Build set of field IDs with validation errors for inline indicators
  const errorFieldIds = new Set(validation?.errors.map((e) => e.fieldId) ?? []);
  const warningFieldIds = new Set(validation?.warnings.filter((w) => w.rule === "low_confidence").map((w) => w.fieldId) ?? []);
  const highConfidencePendingCount = fields.filter(
    (f) =>
      f.confidence !== undefined &&
      f.confidence > 0.8 &&
      values[f.id] &&
      fieldStates[f.id] !== "accepted" &&
      fieldStates[f.id] !== "rejected"
  ).length;

  // -- render --

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{form.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
              <span>{fields.length} fields</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
              <span>{filledCount} filled</span>
              {acceptedCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                  <span className="text-emerald-600">{acceptedCount} accepted</span>
                </>
              )}
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Saving
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-500 inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {highConfidencePendingCount > 0 && (
              <button
                onClick={handleAcceptAllHigh}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Accept All High ({highConfidencePendingCount})
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleValidate}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                Validate
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exporting ? "Exporting..." : "Export"}
              </button>
            )}
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 active:scale-[0.98]"
              >
                {autofilling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Filling...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Autofill from Profile
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? "#10b981"
                  : progress > 50
                  ? "linear-gradient(90deg, #3b82f6, #2563eb)"
                  : "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>

      {/* Validation Results Panel */}
      {validation && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 sm:p-6 space-y-4 animate-slide-down">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Validation Results</h3>
            <button
              onClick={() => { setValidation(null); setShowForceExportDialog(false); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Dismiss
            </button>
          </div>

          {/* Completeness bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Completeness</span>
              <span className="font-medium tabular-nums text-slate-700">{validation.completeness}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${validation.completeness}%`,
                  background: validation.completeness === 100 ? "#10b981" : validation.completeness >= 75 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
          </div>

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""} (must fix before export)
              </div>
              <div className="space-y-1.5">
                {validation.errors.map((err, i) => (
                  <div key={`err-${i}`} className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <span className="text-red-500 shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                    </span>
                    <p className="text-xs text-red-700">{err.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.filter((w) => w.rule === "low_confidence").length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {validation.warnings.filter((w) => w.rule === "low_confidence").length} warning{validation.warnings.filter((w) => w.rule === "low_confidence").length !== 1 ? "s" : ""}
              </div>
              <div className="space-y-1.5">
                {validation.warnings.filter((w) => w.rule === "low_confidence").map((warn, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-amber-500 shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                    </span>
                    <p className="text-xs text-amber-700">{warn.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All clear */}
          {validation.valid && validation.errors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-emerald-700">All checks passed — ready to export</p>
            </div>
          )}
        </div>
      )}

      {/* Force Export Dialog */}
      {showForceExportDialog && validation && !validation.valid && (
        <div className="bg-white rounded-2xl border-2 border-red-200 shadow-soft p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-bold">
              {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""} found. Export anyway?
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Your form has validation errors that could cause rejection. You can fix them or export anyway.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowForceExportDialog(false); }}
              className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Fix Errors
            </button>
            <button
              onClick={() => doExport(true)}
              disabled={exporting}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
            >
              {exporting ? "Exporting..." : "Export Anyway"}
            </button>
          </div>
        </div>
      )}

      {/* Confidence Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          High (&gt;80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          Medium (50-80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
          Low (&lt;50%)
        </span>
      </div>

      {/* Field Cards */}
      <div className="space-y-3">
        {fields.map((field) => {
          const state: FieldState = fieldStates[field.id] ?? "pending";
          const hasAutofill = field.confidence !== undefined && field.confidence > 0 && Boolean(values[field.id]);
          const tier = field.confidence !== undefined && field.confidence > 0 ? confidenceTier(field.confidence) : null;
          const config = tier ? tierConfig[tier] : null;
          const isExplanationExpanded = expandedExplanations.has(field.id);

          const hasError = errorFieldIds.has(field.id);
          const hasWarning = warningFieldIds.has(field.id);

          // Card border color
          let cardClasses = "bg-white border-slate-200";
          if (hasError) {
            cardClasses = "bg-red-50/30 border-red-300";
          } else if (state === "accepted") {
            cardClasses = "bg-emerald-50/30 border-emerald-200";
          } else if (state === "rejected") {
            cardClasses = "bg-white border-slate-200 opacity-70";
          } else if (hasWarning) {
            cardClasses = "bg-amber-50/20 border-amber-200";
          } else if (tier && hasAutofill) {
            cardClasses = `bg-white ${config!.border}`;
          } else if (activeField === field.id) {
            cardClasses = "bg-white border-blue-300 shadow-card";
          }

          // Input styling
          let inputClasses = "mt-2 w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ";
          if (hasError) {
            inputClasses += "border-red-300 bg-red-50/50 focus:ring-red-400";
          } else if (state === "accepted") {
            inputClasses += "border-emerald-200 bg-emerald-50/60 text-slate-700 cursor-not-allowed";
          } else if (state === "rejected") {
            inputClasses += "border-slate-200 bg-white";
          } else if (tier && hasAutofill) {
            inputClasses += `border-slate-200 ${config!.inputBg}`;
          } else {
            inputClasses += "border-slate-200 bg-white";
          }

          // Get inline error/warning messages for this field
          const fieldErrors = validation?.errors.filter((e) => e.fieldId === field.id) ?? [];
          const fieldWarnings = validation?.warnings.filter((w) => w.fieldId === field.id && w.rule === "low_confidence") ?? [];

          return (
            <div
              key={field.id}
              className={`rounded-2xl border transition-all shadow-soft ${cardClasses}`}
            >
              <div className="p-5 space-y-3">
                {/* Top row: label + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`field-${field.id}`}
                        className="text-sm font-semibold text-slate-900"
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 ml-0.5" aria-label="required">*</span>
                        )}
                      </label>

                      {/* State badges */}
                      {state === "accepted" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Accepted
                        </span>
                      )}
                      {state === "rejected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Skipped
                        </span>
                      )}
                    </div>

                    {/* Input */}
                    <input
                      id={`field-${field.id}`}
                      type={field.type === "date" ? "date" : "text"}
                      value={values[field.id] ?? ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      onFocus={() => setActiveField(field.id)}
                      onBlur={() => setActiveField(null)}
                      disabled={state === "accepted"}
                      aria-disabled={state === "accepted"}
                      className={inputClasses}
                      placeholder={state === "rejected" ? "Enter value manually..." : field.example}
                    />
                    {/* Inline validation messages */}
                    {fieldErrors.map((err, i) => (
                      <p key={`fe-${i}`} className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                        {err.message}
                      </p>
                    ))}
                    {fieldWarnings.map((warn, i) => (
                      <p key={`fw-${i}`} className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                        {warn.message}
                      </p>
                    ))}
                  </div>

                  {/* Right column: confidence + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
                    {/* Confidence indicator */}
                    {tier !== null && config && field.confidence !== undefined && field.confidence > 0 && (
                      <div className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg border font-medium ${config.badge}`}>
                        {/* Mini bar */}
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full ${config.bar}`}
                            style={{ width: `${Math.round(field.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums">{Math.round(field.confidence * 100)}%</span>
                      </div>
                    )}

                    {/* Accept / Reject buttons */}
                    {hasAutofill && state === "pending" && (
                      <div className="flex gap-1.5" role="group" aria-label={`Review suggestion for ${field.label}`}>
                        <button
                          onClick={() => handleAccept(field.id)}
                          aria-label={`Accept autofill for ${field.label}`}
                          title="Accept suggestion"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors active:scale-95"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleReject(field.id)}
                          aria-label={`Reject autofill for ${field.label}`}
                          title="Reject and clear"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors active:scale-95"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {state === "rejected" && (
                      <button
                        onClick={() => handleUndoReject(field.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        Undo
                      </button>
                    )}

                    {state === "accepted" && (
                      <button
                        onClick={() => handleUnlock(field.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Explanation - collapsible */}
                <div className="border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleExplanation(field.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExplanationExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    {isExplanationExpanded ? "Hide explanation" : "What should I enter?"}
                  </button>

                  {isExplanationExpanded && (
                    <div className="mt-2.5 bg-blue-50/70 rounded-xl p-4 space-y-2 animate-slide-down">
                      <p className="text-sm text-slate-700 leading-relaxed">{field.explanation}</p>
                      {field.example && (
                        <p className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">Example:</span>{" "}
                          <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">{field.example}</span>
                        </p>
                      )}
                      {field.commonMistakes && (
                        <div className="flex items-start gap-2 mt-1 pt-2 border-t border-blue-100">
                          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">Common mistake:</span> {field.commonMistakes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
