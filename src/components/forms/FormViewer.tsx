"use client";

import { useState, useCallback, useRef } from "react";
import type { FormField, FieldState } from "@/lib/ai/analyze-form";

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

// ── helpers ──────────────────────────────────────────────────────────────────

function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const tierStyles = {
  high: {
    badge: "bg-green-100 text-green-700",
    border: "border-green-300",
    inputBg: "bg-green-50",
  },
  medium: {
    badge: "bg-yellow-100 text-yellow-700",
    border: "border-yellow-300",
    inputBg: "bg-yellow-50",
  },
  low: {
    badge: "bg-red-100 text-red-700",
    border: "border-red-300",
    inputBg: "bg-red-50",
  },
} as const;

// ── component ────────────────────────────────────────────────────────────────

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
      initialFields
        .filter((f) => f.fieldState)
        .map((f) => [f.id, f.fieldState!])
    )
  );

  const [autofilling, setAutofilling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── persistence ─────────────────────────────────────────────────────────

  const scheduleSave = useCallback(
    (
      newValues: Record<string, string>,
      newStates: Record<string, FieldState>
    ) => {
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
            body: JSON.stringify({
              fields: fieldUpdates,
              status: "FILLING",
            }),
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }, 800);
    },
    [form.id]
  );

  // ── field actions ────────────────────────────────────────────────────────

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

  // ── autofill ─────────────────────────────────────────────────────────────

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
      // Set newly autofilled fields to pending; preserve existing user decisions
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

  // ── export ───────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/export`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") ?? "form_filled.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ── derived state ────────────────────────────────────────────────────────

  const filledCount = fields.filter((f) => values[f.id]).length;
  const progress =
    fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  const highConfidencePendingCount = fields.filter(
    (f) =>
      f.confidence !== undefined &&
      f.confidence > 0.8 &&
      values[f.id] &&
      fieldStates[f.id] !== "accepted" &&
      fieldStates[f.id] !== "rejected"
  ).length;

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{form.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {fields.length} fields &middot; {progress}% complete
              {saveStatus === "saving" && (
                <span className="ml-2 text-slate-300">saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="ml-2 text-green-500">saved</span>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {highConfidencePendingCount > 0 && (
              <button
                onClick={handleAcceptAllHigh}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Accept All High Confidence ({highConfidencePendingCount})
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export"}
              </button>
            )}
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {autofilling ? "Filling..." : "Autofill from Profile"}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-400" aria-hidden="true" />
          High confidence (&gt;80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" aria-hidden="true" />
          Medium confidence (50&ndash;80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
          Low confidence (&lt;50%)
        </span>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((field) => {
          const state: FieldState = fieldStates[field.id] ?? "pending";
          const hasAutofill =
            field.confidence !== undefined &&
            field.confidence > 0 &&
            Boolean(values[field.id]);
          const tier =
            field.confidence !== undefined && field.confidence > 0
              ? confidenceTier(field.confidence)
              : null;

          // Outer card border
          let cardBorder = "border-slate-200";
          if (state === "accepted") cardBorder = "border-green-400";
          else if (state === "rejected") cardBorder = "border-slate-300";
          else if (tier) cardBorder = tierStyles[tier].border;
          else if (activeField === field.id) cardBorder = "border-blue-400";

          // Card background
          const cardBg =
            state === "accepted"
              ? "bg-green-50/40"
              : state === "rejected"
              ? "bg-white"
              : "bg-white";

          // Input style
          let inputClass =
            "mt-2 w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ";
          if (state === "accepted") {
            inputClass +=
              "border-green-200 bg-green-50 text-slate-700 cursor-not-allowed";
          } else if (state === "rejected") {
            inputClass += "border-slate-200 bg-white focus:ring-blue-400";
          } else if (tier) {
            inputClass += `border-slate-200 ${tierStyles[tier].inputBg} focus:ring-blue-400`;
          } else {
            inputClass += "border-slate-200 focus:ring-blue-400";
          }

          return (
            <div
              key={field.id}
              className={`rounded-xl border transition-all shadow-sm ${cardBorder} ${cardBg}`}
            >
              <div className="p-5 space-y-3">
                {/* Label + input row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`field-${field.id}`}
                        className="text-sm font-semibold text-slate-900"
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 ml-1" aria-label="required">
                            *
                          </span>
                        )}
                      </label>

                      {/* State badge */}
                      {state === "accepted" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Accepted
                        </span>
                      )}
                      {state === "rejected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Rejected
                        </span>
                      )}
                    </div>

                    <input
                      id={`field-${field.id}`}
                      type={field.type === "date" ? "date" : "text"}
                      value={values[field.id] ?? ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      onFocus={() => setActiveField(field.id)}
                      onBlur={() => setActiveField(null)}
                      disabled={state === "accepted"}
                      aria-disabled={state === "accepted"}
                      className={inputClass}
                      placeholder={
                        state === "rejected"
                          ? "Enter value manually..."
                          : field.example
                      }
                    />
                  </div>

                  {/* Right column: confidence badge + action buttons */}
                  <div className="flex flex-col items-end gap-2 shrink-0 mt-1">
                    {tier !== null &&
                      field.confidence !== undefined &&
                      field.confidence > 0 && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${tierStyles[tier].badge}`}
                        >
                          {Math.round(field.confidence * 100)}% match
                        </span>
                      )}

                    {/* Accept / Reject — only shown when there is an autofill value and state is pending */}
                    {hasAutofill && state === "pending" && (
                      <div className="flex gap-1.5" role="group" aria-label={`Review suggestion for ${field.label}`}>
                        <button
                          onClick={() => handleAccept(field.id)}
                          aria-label={`Accept autofill for ${field.label}`}
                          title="Accept suggestion"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleReject(field.id)}
                          aria-label={`Reject autofill for ${field.label}`}
                          title="Reject suggestion"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Undo rejected */}
                    {state === "rejected" && (
                      <button
                        onClick={() => handleUndoReject(field.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                      >
                        Undo reject
                      </button>
                    )}

                    {/* Unlock accepted */}
                    {state === "accepted" && (
                      <button
                        onClick={() => handleUnlock(field.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* AI explanation */}
                <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700">What to enter</p>
                  <p className="text-sm text-blue-900">{field.explanation}</p>
                  {field.commonMistakes && (
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-medium text-amber-600">Common mistake:</span>{" "}
                      {field.commonMistakes}
                    </p>
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
