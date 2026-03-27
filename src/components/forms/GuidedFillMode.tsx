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

// Group fields by category based on profileKey or label patterns
function groupFields(fields: FormField[]): { name: string; fields: FormField[] }[] {
  const groups: Record<string, FormField[]> = {};

  for (const field of fields) {
    let category = "Other";
    const key = field.profileKey?.toLowerCase() ?? "";
    const label = field.label.toLowerCase();

    if (
      key.startsWith("address") ||
      label.includes("address") ||
      label.includes("city") ||
      label.includes("state") ||
      label.includes("zip") ||
      label.includes("country")
    ) {
      category = "Address";
    } else if (
      ["firstname", "lastname", "email", "phone", "dateofbirth"].includes(key) ||
      label.includes("name") ||
      label.includes("email") ||
      label.includes("phone") ||
      label.includes("birth") ||
      label.includes("dob")
    ) {
      category = "Personal Information";
    } else if (
      ["employername", "jobtitle", "annualincome"].includes(key) ||
      label.includes("employer") ||
      label.includes("job") ||
      label.includes("occupation") ||
      label.includes("income") ||
      label.includes("salary") ||
      label.includes("company")
    ) {
      category = "Employment";
    } else if (
      ["ssn", "passportnumber"].includes(key) ||
      label.includes("ssn") ||
      label.includes("social security") ||
      label.includes("passport") ||
      label.includes("license") ||
      label.includes("id number")
    ) {
      category = "Identity Documents";
    }

    if (!groups[category]) groups[category] = [];
    groups[category].push(field);
  }

  // Order: Personal → Address → Employment → Identity → Other
  const order = ["Personal Information", "Address", "Employment", "Identity Documents", "Other"];
  return order
    .filter((name) => groups[name]?.length)
    .map((name) => ({ name, fields: groups[name] }));
}

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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                {currentStep + 1}
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {currentGroup?.name ?? "Complete"}
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Step {currentStep + 1} of {totalSteps} &middot; {overallProgress}% overall
              {saveStatus === "saving" && <span className="ml-2 text-slate-400">saving...</span>}
              {saveStatus === "saved" && <span className="ml-2 text-green-500">saved</span>}
            </p>
          </div>

          <div className="flex gap-2">
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {autofilling ? "Filling..." : "Autofill"}
              </button>
            )}
            <button
              onClick={onExit}
              className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            >
              Exit Guided Mode
            </button>
          </div>
        </div>

        {/* Step progress dots */}
        <div className="flex gap-1.5 mt-4">
          {groups.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setCurrentStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentStep
                  ? "bg-blue-500 flex-[2]"
                  : i < currentStep
                  ? "bg-green-400 flex-1"
                  : "bg-slate-200 flex-1"
              }`}
              aria-label={`Go to step ${i + 1}: ${g.name}`}
            />
          ))}
        </div>

        {/* Group progress */}
        <p className="text-xs text-slate-400 mt-2">
          {filledInGroup}/{totalInGroup} fields completed in this section
        </p>
      </div>

      {/* Fields for current step */}
      <div className="space-y-4">
        {currentGroup?.fields.map((field) => {
          const state: FieldState = fieldStates[field.id] ?? "pending";
          const hasValue = Boolean(values[field.id]);
          const confidence = field.confidence ?? 0;

          return (
            <div
              key={field.id}
              className={`bg-white rounded-xl border p-6 space-y-4 transition-all ${
                state === "accepted"
                  ? "border-green-300 bg-green-50/30"
                  : state === "rejected"
                  ? "border-slate-200 opacity-60"
                  : "border-slate-200"
              }`}
            >
              {/* Field label */}
              <div className="flex items-center justify-between">
                <label htmlFor={`guided-${field.id}`} className="text-base font-semibold text-slate-900">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <span className="text-xs text-slate-400">{field.type}</span>
              </div>

              {/* Explanation */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-blue-900">{field.explanation}</p>
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Example:</span> {field.example}
                </p>
                {field.commonMistakes && (
                  <p className="text-xs text-amber-600">
                    <span className="font-medium">Common mistake:</span> {field.commonMistakes}
                  </p>
                )}
              </div>

              {/* Autofill suggestion */}
              {hasValue && confidence > 0 && state === "pending" && (
                <div className={`rounded-lg p-3 flex items-center justify-between ${
                  confidence >= 0.8 ? "bg-green-50 border border-green-200" :
                  confidence >= 0.5 ? "bg-yellow-50 border border-yellow-200" :
                  "bg-red-50 border border-red-200"
                }`}>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Suggested: <span className="text-slate-900">{values[field.id]}</span>
                    </p>
                    <p className="text-xs text-slate-500">{Math.round(confidence * 100)}% confidence</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(field.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleSkip(field.id)}
                      className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              {state !== "rejected" && (
                <input
                  id={`guided-${field.id}`}
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.id] ?? ""}
                  onChange={(e) => handleValueChange(field.id, e.target.value)}
                  disabled={state === "accepted"}
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    state === "accepted"
                      ? "border-green-200 bg-green-50 cursor-not-allowed"
                      : "border-slate-200"
                  }`}
                  placeholder={field.example}
                />
              )}

              {state === "rejected" && (
                <div className="flex items-center gap-2">
                  <input
                    id={`guided-${field.id}`}
                    type={field.type === "date" ? "date" : "text"}
                    value={values[field.id] ?? ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Enter value manually..."
                  />
                  <button
                    onClick={() => {
                      const newStates = { ...fieldStates };
                      delete newStates[field.id];
                      setFieldStates(newStates);
                      scheduleSave(values, newStates);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline whitespace-nowrap"
                  >
                    Undo
                  </button>
                </div>
              )}

              {/* Skip button for unfilled fields */}
              {!hasValue && state === "pending" && !field.required && (
                <button
                  onClick={() => handleSkip(field.id)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Skip this field
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <span className="text-sm text-slate-500">
          {currentStep + 1} / {totalSteps}
        </span>

        {currentStep < totalSteps - 1 ? (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Next Section
          </button>
        ) : (
          <button
            onClick={onExit}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
