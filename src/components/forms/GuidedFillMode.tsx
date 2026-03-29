"use client";

import { useState, useCallback, useRef } from "react";
import type { FormField, FieldState } from "@/lib/ai/analyze-form";

interface Props {
  formId: string;
  fields: FormField[];
  initialValues: Record<string, string>;
  initialStates: Record<string, FieldState>;
  hasProfile: boolean;
  onExit: () => void;
  onValuesChange: (values: Record<string, string>, states: Record<string, FieldState>) => void;
}

// Group fields by category
function groupFields(fields: FormField[]): { name: string; icon: string; fields: FormField[] }[] {
  const groups: Record<string, FormField[]> = {};

  for (const field of fields) {
    let category = "Other";
    const key = field.profileKey?.toLowerCase() ?? "";
    const label = field.label.toLowerCase();

    if (
      key.startsWith("address") || label.includes("address") || label.includes("city") ||
      label.includes("state") || label.includes("zip") || label.includes("country")
    ) {
      category = "Address";
    } else if (
      ["firstname", "lastname", "email", "phone", "dateofbirth"].includes(key) ||
      label.includes("name") || label.includes("email") || label.includes("phone") ||
      label.includes("birth") || label.includes("dob")
    ) {
      category = "Personal Information";
    } else if (
      ["employername", "jobtitle", "annualincome"].includes(key) ||
      label.includes("employer") || label.includes("job") || label.includes("occupation") ||
      label.includes("income") || label.includes("salary") || label.includes("company")
    ) {
      category = "Employment";
    } else if (
      ["ssn", "passportnumber"].includes(key) || label.includes("ssn") ||
      label.includes("social security") || label.includes("passport") ||
      label.includes("license") || label.includes("id number")
    ) {
      category = "Identity Documents";
    }

    if (!groups[category]) groups[category] = [];
    groups[category].push(field);
  }

  const categoryMeta: Record<string, string> = {
    "Personal Information": "user",
    "Address": "map-pin",
    "Employment": "briefcase",
    "Identity Documents": "shield",
    "Other": "file-text",
  };

  const order = ["Personal Information", "Address", "Employment", "Identity Documents", "Other"];
  return order
    .filter((name) => groups[name]?.length)
    .map((name) => ({ name, icon: categoryMeta[name] ?? "file-text", fields: groups[name] }));
}

function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const tierColors = {
  high: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500" },
  medium: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500" },
  low: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", bar: "bg-red-500" },
};

export default function GuidedFillMode({
  formId,
  fields,
  initialValues,
  initialStates,
  hasProfile,
  onExit,
  onValuesChange,
}: Props) {
  const groups = groupFields(fields);
  const totalSteps = groups.length;

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(initialStates);
  const [autofilling, setAutofilling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentGroup = groups[currentStep];

  const scheduleSave = useCallback(
    (newValues: Record<string, string>, newStates: Record<string, FieldState>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = setTimeout(async () => {
        try {
          const allFieldIds = new Set([...Object.keys(newValues), ...Object.keys(newStates)]);
          const fieldUpdates = Array.from(allFieldIds).map((id) => ({
            id,
            ...(id in newValues ? { value: newValues[id] } : {}),
            ...(id in newStates ? { fieldState: newStates[id] } : {}),
          }));
          await fetch(`/api/forms/${formId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: fieldUpdates, status: "FILLING" }),
          });
          setSaveStatus("saved");
          onValuesChange(newValues, newStates);
        } catch {
          setSaveStatus("idle");
        }
      }, 500);
    },
    [formId, onValuesChange]
  );

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

  function handleSkip(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "rejected" as FieldState };
    const newValues = { ...values };
    delete newValues[fieldId];
    setValues(newValues);
    setFieldStates(newStates);
    scheduleSave(newValues, newStates);
  }

  function handleUndoSkip(fieldId: string) {
    const newStates = { ...fieldStates };
    delete newStates[fieldId];
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  async function handleAutofill() {
    setAutofilling(true);
    try {
      const res = await fetch(`/api/forms/${formId}/autofill`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      const newFields: FormField[] = data.fields;
      const newValues = { ...values };
      const newStates = { ...fieldStates };
      for (const f of newFields) {
        if (f.value && !newStates[f.id]) {
          newValues[f.id] = f.value;
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

  const filledInGroup = currentGroup?.fields.filter((f) => values[f.id]).length ?? 0;
  const totalInGroup = currentGroup?.fields.length ?? 0;
  const totalFilled = fields.filter((f) => values[f.id]).length;
  const overallProgress = fields.length > 0 ? Math.round((totalFilled / fields.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 text-blue-700 text-sm font-bold">
                {currentStep + 1}
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {currentGroup?.name ?? "Complete"}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Step {currentStep + 1} of {totalSteps}
                  <span className="mx-1.5">&middot;</span>
                  {overallProgress}% overall
                  {saveStatus === "saving" && (
                    <span className="ml-2 inline-flex items-center gap-1 text-slate-300">
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                      </svg>
                      Saving
                    </span>
                  )}
                  {saveStatus === "saved" && <span className="ml-2 text-emerald-500">Saved</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors active:scale-[0.98]"
              >
                {autofilling ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Filling...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Autofill
                  </>
                )}
              </button>
            )}
            <button
              onClick={onExit}
              className="px-3.5 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Exit Guided Mode
            </button>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex gap-1.5 mt-5">
          {groups.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setCurrentStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "bg-blue-500 flex-[2]"
                  : i < currentStep
                  ? "bg-emerald-400 flex-1 hover:bg-emerald-500"
                  : "bg-slate-200 flex-1 hover:bg-slate-300"
              }`}
              aria-label={`Go to step ${i + 1}: ${g.name}`}
            />
          ))}
        </div>

        {/* Group progress */}
        <div className="space-y-1.5 mt-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{filledInGroup}/{totalInGroup} fields completed in this section</span>
            <span className="font-medium tabular-nums">{totalInGroup > 0 ? Math.round((filledInGroup / totalInGroup) * 100) : 0}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalInGroup > 0 ? Math.round((filledInGroup / totalInGroup) * 100) : 0}%`,
                background: totalInGroup > 0 && Math.round((filledInGroup / totalInGroup) * 100) === 100
                  ? "#10b981"
                  : "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {currentGroup?.fields.map((field, index) => {
          const state: FieldState = fieldStates[field.id] ?? "pending";
          const hasValue = Boolean(values[field.id]);
          const confidence = field.confidence ?? 0;
          const tier = confidence > 0 ? confidenceTier(confidence) : null;
          const colors = tier ? tierColors[tier] : null;

          return (
            <div
              key={field.id}
              className={`bg-white rounded-2xl border p-5 sm:p-6 space-y-4 transition-all shadow-soft animate-fade-in-up ${
                state === "accepted"
                  ? "border-emerald-200 bg-emerald-50/30"
                  : state === "rejected"
                  ? "border-slate-200 opacity-60"
                  : "border-slate-200"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Field label + type */}
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`guided-${field.id}`}
                  className="text-base font-semibold text-slate-900"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <span className="text-xs text-slate-300 font-medium uppercase tracking-wide">
                  {field.type}
                </span>
              </div>

              {/* Explanation */}
              <div className="bg-blue-50/60 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-700 leading-relaxed">{field.explanation}</p>
                {field.example && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Example:</span>{" "}
                    <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">{field.example}</span>
                  </p>
                )}
                {field.commonMistakes && (
                  <div className="flex items-start gap-2 pt-2 border-t border-blue-100/80">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-amber-700">
                      <span className="font-medium">Common mistake:</span> {field.commonMistakes}
                    </p>
                  </div>
                )}
              </div>

              {/* Where to find this */}
              {field.whereToFind && (
                <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Where to find this</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{field.whereToFind}</p>
                  </div>
                </div>
              )}

              {/* Autofill suggestion */}
              {hasValue && confidence > 0 && state === "pending" && colors && (
                <div className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${colors.bg} border ${colors.border}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      Suggested: <span className="text-slate-900 font-semibold">{values[field.id]}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-16 h-1.5 bg-white/60 rounded-full overflow-hidden" aria-hidden="true">
                        <div
                          className={`h-full rounded-full ${colors.bar}`}
                          style={{ width: `${Math.round(confidence * 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${colors.text} tabular-nums`}>
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(field.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98]"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Accept
                    </button>
                    <button
                      onClick={() => handleSkip(field.id)}
                      className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              {field.type === "checkbox" ? (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    id={`guided-${field.id}`}
                    type="button"
                    role="checkbox"
                    aria-checked={values[field.id] === "Checked"}
                    disabled={state === "accepted"}
                    onClick={() => {
                      const next = values[field.id] === "Checked" ? "Unchecked" : "Checked";
                      handleValueChange(field.id, next);
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      values[field.id] === "Checked" ? "bg-blue-500" : "bg-slate-200"
                    } ${state === "accepted" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        values[field.id] === "Checked" ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-slate-600">
                    {values[field.id] === "Checked" ? "Checked" : "Unchecked"}
                  </span>
                </div>
              ) : state !== "rejected" ? (
                <input
                  id={`guided-${field.id}`}
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.id] ?? ""}
                  onChange={(e) => handleValueChange(field.id, e.target.value)}
                  disabled={state === "accepted"}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                    state === "accepted"
                      ? "border-emerald-200 bg-emerald-50/60 cursor-not-allowed"
                      : "border-slate-200 bg-white"
                  }`}
                  placeholder={field.example}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    id={`guided-${field.id}`}
                    type={field.type === "date" ? "date" : "text"}
                    value={values[field.id] ?? ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Enter value manually..."
                  />
                  <button
                    onClick={() => handleUndoSkip(field.id)}
                    className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap transition-colors"
                  >
                    Undo
                  </button>
                </div>
              )}

              {/* Skip for unfilled optional */}
              {!hasValue && state === "pending" && !field.required && (
                <button
                  onClick={() => handleSkip(field.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Skip this field
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center bg-white rounded-2xl border border-slate-200 shadow-soft p-4">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>

        <div className="text-sm text-slate-400 tabular-nums">
          {currentStep + 1} / {totalSteps}
        </div>

        {currentStep < totalSteps - 1 ? (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            Next Section
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
