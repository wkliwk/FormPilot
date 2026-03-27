"use client";

import { useState } from "react";
import FormViewer from "./FormViewer";
import GuidedFillMode from "./GuidedFillMode";
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

export default function FormPageClient({ form, hasProfile }: Props) {
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [formData, setFormData] = useState(form);

  const fields = formData.fields as FormField[];
  const initialValues = Object.fromEntries(
    fields.filter((f) => f.value).map((f) => [f.id, f.value!])
  );
  const initialStates = Object.fromEntries(
    fields.filter((f) => f.fieldState).map((f) => [f.id, f.fieldState!])
  );

  function handleValuesChange(newValues: Record<string, string>, newStates: Record<string, FieldState>) {
    // Sync values back to form data so switching modes preserves state
    const updatedFields = fields.map((f) => ({
      ...f,
      value: newValues[f.id] ?? f.value,
      fieldState: newStates[f.id] ?? f.fieldState,
    }));
    setFormData({ ...formData, fields: updatedFields as unknown });
  }

  if (mode === "guided") {
    return (
      <GuidedFillMode
        formId={form.id}
        fields={fields}
        initialValues={initialValues}
        initialStates={initialStates}
        hasProfile={hasProfile}
        onExit={() => setMode("full")}
        onValuesChange={handleValuesChange}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Guided fill toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setMode("guided")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
          Guided Fill Mode
        </button>
      </div>
      <FormViewer form={formData} hasProfile={hasProfile} />
    </div>
  );
}
