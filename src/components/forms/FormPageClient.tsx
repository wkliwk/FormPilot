"use client";

import { useState } from "react";
import FormViewer from "./FormViewer";
import GuidedFillMode from "./GuidedFillMode";
import type { FormField, FieldState } from "@/lib/ai/analyze-form";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tl", label: "Tagalog" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
] as const;

type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

interface FormRecord {
  id: string;
  title: string;
  status: string;
  fields: unknown;
}

interface Props {
  form: FormRecord;
  hasProfile: boolean;
  preferredLanguage?: string | null;
}

export default function FormPageClient({ form, hasProfile, preferredLanguage }: Props) {
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [formData, setFormData] = useState(form);
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(
    (preferredLanguage as LanguageCode | undefined) ?? "en"
  );
  const [reExplaining, setReExplaining] = useState(false);
  const [reExplainError, setReExplainError] = useState<string | null>(null);

  const fields = formData.fields as FormField[];
  const initialValues = Object.fromEntries(
    fields.filter((f) => f.value).map((f) => [f.id, f.value!])
  );
  const initialStates = Object.fromEntries(
    fields.filter((f) => f.fieldState).map((f) => [f.id, f.fieldState!])
  );

  function handleValuesChange(newValues: Record<string, string>, newStates: Record<string, FieldState>) {
    const updatedFields = fields.map((f) => ({
      ...f,
      value: newValues[f.id] ?? f.value,
      fieldState: newStates[f.id] ?? f.fieldState,
    }));
    setFormData({ ...formData, fields: updatedFields as unknown });
  }

  async function handleLanguageChange(lang: LanguageCode) {
    if (lang === activeLanguage) return;
    setActiveLanguage(lang);
    setReExplainError(null);
    setReExplaining(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/re-explain?lang=${lang}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Re-explain failed");
      }
      const data = await res.json() as { fields: FormField[] };
      setFormData({ ...formData, fields: data.fields as unknown });
    } catch (err) {
      setReExplainError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReExplaining(false);
    }
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
      {/* Mode toggle bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 shadow-soft px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setMode("full")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "full"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Fields
            </button>
            <button
              onClick={() => setMode("guided")}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-all text-slate-500 hover:text-slate-700"
            >
              Guided Mode
            </button>
          </div>

          {/* Language selector */}
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            <select
              value={activeLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
              disabled={reExplaining}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Explanation language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            {reExplaining && (
              <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            )}
          </div>
        </div>

        <button
          onClick={() => setMode("guided")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 16 16 12 12 8" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Start Guided Fill
        </button>
      </div>

      {reExplainError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-700">{reExplainError}</p>
        </div>
      )}

      {reExplaining && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          <p className="text-sm text-blue-700">Translating field explanations...</p>
        </div>
      )}

      <FormViewer form={formData} hasProfile={hasProfile} />
    </div>
  );
}
