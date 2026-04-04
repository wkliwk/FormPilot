"use client";

import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { generateSampleValue } from "@/lib/sample-data";
import { DEMO_FORMS } from "@/lib/demo-forms";
import type { DemoField } from "@/lib/demo-forms";
import DemoNudgeBanner from "@/components/forms/DemoNudgeBanner";
import type { FormField } from "@/lib/ai/analyze-form";

function buildInitialValues(fields: DemoField[]): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => [
      f.id,
      f.type === "checkbox" ? "checked" : f.type === "select" ? (f.options?.[0] ?? "") : generateSampleValue({ label: f.label, type: f.type }),
    ])
  );
}

function SparkleIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function DemoPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DemoPage />
    </Suspense>
  );
}

type DemoMode = "sample" | "upload";
type UploadStatus = "idle" | "uploading" | "done" | "error";

function DemoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formSlug = searchParams.get("form") ?? "job-application";
  const selectedForm = DEMO_FORMS.find((f) => f.slug === formSlug) ?? DEMO_FORMS[0];
  const currentFields = selectedForm.fields;

  // Tab state
  const [mode, setMode] = useState<DemoMode>("sample");

  // Sample-form state
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(currentFields));
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const interactedFields = useRef(new Set<string>());
  const explainRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevSlugRef = useRef(formSlug);

  // Upload-form state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedTitle, setUploadedTitle] = useState<string>("");
  const [uploadedFields, setUploadedFields] = useState<FormField[]>([]);
  const [uploadValues, setUploadValues] = useState<Record<string, string>>({});
  const [uploadActiveField, setUploadActiveField] = useState<string | null>(null);
  const [uploadEditCount, setUploadEditCount] = useState(0);
  const uploadEditedFields = useRef(new Set<string>());
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset values when form type changes
  if (prevSlugRef.current !== formSlug) {
    prevSlugRef.current = formSlug;
    setValues(buildInitialValues(currentFields));
    setActiveFieldId(null);
    setInteractionCount(0);
    interactedFields.current = new Set();
  }

  const switchForm = useCallback((slug: string) => {
    router.push(`/demo?form=${slug}`, { scroll: false });
  }, [router]);

  function handleFieldFocus(fieldId: string) {
    setActiveFieldId(fieldId);
    if (!interactedFields.current.has(fieldId)) {
      interactedFields.current.add(fieldId);
      setInteractionCount((c) => c + 1);
    }
    const el = explainRefs.current[fieldId];
    if (el && window.innerWidth < 640) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function clearAll() {
    setValues(Object.fromEntries(currentFields.map((f) => [f.id, ""])));
  }

  function resetSample() {
    setValues(buildInitialValues(currentFields));
  }

  const filledCount = Object.values(values).filter((v) => v && v.trim()).length;

  // Upload mode handlers
  async function handleFileUpload(file: File) {
    setUploadStatus("uploading");
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/demo/upload", { method: "POST", body: fd });
      const data = await res.json() as { title?: string; fields?: FormField[]; error?: string };
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed. Please try again.");
        setUploadStatus("error");
        return;
      }
      setUploadedTitle(data.title ?? file.name);
      setUploadedFields(data.fields ?? []);
      setUploadValues({});
      setUploadActiveField(null);
      setUploadEditCount(0);
      uploadEditedFields.current = new Set();
      setUploadStatus("done");
    } catch {
      setUploadError("Network error. Please check your connection and try again.");
      setUploadStatus("error");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function handleUploadFieldFocus(fieldId: string) {
    setUploadActiveField(fieldId);
    if (!uploadEditedFields.current.has(fieldId)) {
      uploadEditedFields.current.add(fieldId);
      setUploadEditCount((c) => c + 1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <Link href="/login?from=demo" className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <DemoNudgeBanner />

        {/* Mode toggle */}
        <div className="mb-6 flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setMode("sample")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "sample" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sample forms
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Upload your own
          </button>
        </div>

        {/* Sample form type selector — only shown in sample mode */}
        {mode === "sample" && (
          <div className="mb-6 flex flex-wrap gap-2">
            {DEMO_FORMS.map((df) => (
              <button
                key={df.slug}
                onClick={() => switchForm(df.slug)}
                className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
                  df.slug === selectedForm.slug
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {df.badge} {df.label}
              </button>
            ))}
          </div>
        )}

        {mode === "upload" ? (
          /* ── Upload your own form ── */
          <div>
            {uploadStatus !== "done" ? (
              /* Upload zone */
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs font-medium text-violet-700 mb-3">
                    <SparkleIcon />
                    Upload your own form
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    Try it on a real form
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Upload any PDF or Word document. FormPilot analyses every field and explains it in plain language — no sign-up required.
                  </p>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl px-6 py-16 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-blue-400 bg-blue-50"
                      : uploadStatus === "uploading"
                      ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={uploadStatus === "uploading"}
                  />
                  {uploadStatus === "uploading" ? (
                    <>
                      <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-700">Analysing your form…</p>
                      <p className="text-xs text-slate-400 mt-1">This usually takes 10–20 seconds</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-slate-300 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="12" y2="12" />
                        <line x1="15" y1="15" x2="12" y2="12" />
                      </svg>
                      <p className="text-sm font-semibold text-slate-700">Drop your form here or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">PDF or Word document · max 5MB · max 3 pages</p>
                    </>
                  )}
                </div>

                {uploadStatus === "error" && uploadError && (
                  <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                    {uploadError}
                  </div>
                )}

                <p className="mt-4 text-xs text-slate-400 text-center">
                  Your file is analysed and not stored. <Link href="/privacy" className="underline hover:text-slate-600">Privacy policy</Link>
                </p>
              </div>
            ) : (
              /* Analysed form fields */
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs font-medium text-violet-700 mb-3">
                    <SparkleIcon />
                    AI Analysis complete
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {uploadedTitle}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {uploadedFields.length} fields detected. Click any field to see its AI explanation.
                  </p>
                </div>

                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => { setUploadStatus("idle"); setUploadError(null); }}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    ← Upload a different form
                  </button>
                </div>

                {/* Conversion nudge after 3 edits */}
                {uploadEditCount >= 3 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-blue-800">
                      <strong>You've filled {uploadEditCount} fields manually.</strong> Create a free account and FormPilot fills them from your profile automatically.
                    </p>
                    <Link href="/login?from=demo-upload" className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                      Sign up free
                    </Link>
                  </div>
                )}

                <div className="space-y-4">
                  {uploadedFields.map((field) => {
                    const isActive = uploadActiveField === field.id;
                    const value = uploadValues[field.id] ?? "";
                    const isFilled = !!value.trim();
                    return (
                      <div
                        key={field.id}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                          isActive ? "border-blue-300 ring-2 ring-blue-100" : isFilled ? "border-emerald-200" : "border-slate-200"
                        }`}
                      >
                        <div className={`h-1 w-full ${isFilled ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" />
                        <div className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <label htmlFor={`upload-${field.id}`} className="text-sm font-semibold text-slate-900">
                              {field.label}
                            </label>
                            {field.required && (
                              <span className="shrink-0 text-xs text-slate-400">Required</span>
                            )}
                          </div>
                          <input
                            id={`upload-${field.id}`}
                            type="text"
                            value={value}
                            onChange={(e) => setUploadValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                            onFocus={() => handleUploadFieldFocus(field.id)}
                            placeholder={`Enter ${field.label.toLowerCase()}…`}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 font-medium mb-3 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                          />
                          <div className={`rounded-xl px-4 py-3 border transition-colors ${
                            isActive ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <SparkleIcon />
                              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Explanation</span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">{field.explanation}</p>
                            {field.example && (
                              <p className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                                <span className="font-medium text-slate-600">Example:</span> {field.example}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Autofill CTA */}
                <div className="mt-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl px-6 py-7 text-center shadow-lg">
                  <p className="text-white font-semibold text-base mb-1">Want FormPilot to autofill this?</p>
                  <p className="text-blue-100 text-sm mb-5">
                    Create a free profile and FormPilot fills your name, address, and more automatically — across any form.
                  </p>
                  <Link
                    href="/login?from=demo-upload"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-all shadow-md active:scale-[0.98]"
                  >
                    Create your free account
                    <ArrowRightIcon />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Sample forms ── */
          <div>
        {/* Form header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-full text-xs font-medium text-violet-700 mb-3">
            <SparkleIcon />
            Interactive demo
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {selectedForm.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {selectedForm.subtitle}
          </p>
        </div>

        {/* Action bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shrink-0">
              <CheckIcon />
            </div>
            <span className="text-sm font-semibold text-emerald-800">
              {filledCount}/{currentFields.length} fields filled
            </span>
          </div>
          <button onClick={clearAll} className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Clear all &amp; try yourself
          </button>
          <button onClick={resetSample} className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Reset sample data
          </button>
        </div>

        {/* Interaction CTA */}
        {interactionCount >= 3 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-800">
              <strong>Like this?</strong> Upload your own form — FormPilot reads any PDF, Word doc, or image.
            </p>
            <button onClick={() => setMode("upload")} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Upload your form
            </button>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4">
          {currentFields.map((field) => {
            const isCheckbox = field.type === "checkbox";
            const isActive = activeFieldId === field.id;
            const value = values[field.id] ?? "";
            const isFilled = !!value.trim();

            return (
              <div
                key={field.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                  isActive ? "border-blue-300 ring-2 ring-blue-100" : isFilled ? "border-emerald-200" : "border-slate-200"
                }`}
              >
                <div className={`h-1 w-full ${isFilled ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" />

                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <label htmlFor={`demo-${field.id}`} className="text-sm font-semibold text-slate-900">
                      {field.label}
                    </label>
                    {isFilled && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                        <CheckIcon />
                        Filled
                      </span>
                    )}
                  </div>

                  {isCheckbox ? (
                    <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id={`demo-${field.id}`}
                        checked={value === "checked"}
                        onChange={(e) => handleChange(field.id, e.target.checked ? "checked" : "")}
                        onFocus={() => handleFieldFocus(field.id)}
                        className="w-5 h-5 rounded border-2 border-slate-300 text-emerald-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">Yes</span>
                    </label>
                  ) : field.type === "select" ? (
                    <select
                      id={`demo-${field.id}`}
                      value={value}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onFocus={() => handleFieldFocus(field.id)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 font-medium mb-3 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`demo-${field.id}`}
                      type={field.type === "date" ? "date" : "text"}
                      value={value}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onFocus={() => handleFieldFocus(field.id)}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 font-medium mb-3 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  )}

                  <div
                    ref={(el) => { explainRefs.current[field.id] = el; }}
                    className={`rounded-xl px-4 py-3 border transition-colors ${
                      isActive ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <SparkleIcon />
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        AI Explanation
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{field.explanation}</p>
                    <p className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                      <span className="font-medium text-slate-600">Tip:</span> {field.tip}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 bg-slate-900 rounded-2xl px-6 py-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-white">
            Ready to fill your own forms?
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Upload any PDF or Word form. FormPilot reads it, explains every
            field, and fills what it can from your profile.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?from=demo"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
            >
              Create your free account
              <ArrowRightIcon />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 border border-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
        </div>
        )} {/* end mode ternary */}
      </div>
    </div>
  );
}
