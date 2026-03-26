"use client";

import { useState, useCallback, useRef } from "react";
import type { FormField } from "@/lib/ai/analyze-form";

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

export default function FormViewer({ form, hasProfile }: Props) {
  const [fields, setFields] = useState<FormField[]>(form.fields as FormField[]);
  const [autofilling, setAutofilling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (newValues: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/forms/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: Object.entries(newValues).map(([id, value]) => ({ id, value })),
              status: "FILLING",
            }),
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }, 1000);
    },
    [form.id]
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.filter((f) => f.value).map((f) => [f.id, f.value!]))
  );

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/export`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ?? "form_filled.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleAutofill() {
    setAutofilling(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/autofill`, { method: "POST" });
      if (!res.ok) throw new Error("Autofill failed");
      const data = await res.json();
      setFields(data.fields);
      setValues(Object.fromEntries(
        data.fields.filter((f: FormField) => f.value).map((f: FormField) => [f.id, f.value!])
      ));
    } finally {
      setAutofilling(false);
    }
  }

  const filledCount = fields.filter((f) => values[f.id]).length;
  const progress = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{form.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {fields.length} fields · {progress}% complete
              {saveStatus === "saving" && <span className="ml-2 text-slate-300">saving...</span>}
              {saveStatus === "saved" && <span className="ml-2 text-green-500">saved</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {filledCount > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "⬇ Export"}
              </button>
            )}
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {autofilling ? "Filling..." : "⚡ Autofill from Profile"}
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

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((field) => (
          <div
            key={field.id}
            className={`bg-white rounded-xl border transition-all ${
              activeField === field.id
                ? "border-blue-400 shadow-sm"
                : "border-slate-200"
            }`}
          >
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-900">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={values[field.id] ?? ""}
                    onChange={(e) => {
                      const newValues = { ...values, [field.id]: e.target.value };
                      setValues(newValues);
                      scheduleSave(newValues);
                    }}
                    onFocus={() => setActiveField(field.id)}
                    onBlur={() => setActiveField(null)}
                    className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder={field.example}
                  />
                </div>

                {field.confidence !== undefined && field.confidence > 0 && (
                  <div className={`mt-6 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                    field.confidence >= 0.8
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {Math.round(field.confidence * 100)}% match
                  </div>
                )}
              </div>

              {/* AI explanation — always visible */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-blue-700">What to enter</p>
                <p className="text-sm text-blue-900">{field.explanation}</p>
                {field.commonMistakes && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-amber-600">Common mistake:</span> {field.commonMistakes}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
