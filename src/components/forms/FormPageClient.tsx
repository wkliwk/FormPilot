"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import FormViewer from "./FormViewer";
import GuidedFillMode from "./GuidedFillMode";
import FormCompleteOverlay from "./FormCompleteOverlay";
import AutoSaveIndicator, { type SaveStatus } from "./AutoSaveIndicator";

// pdf.js uses DOMMatrix at module-level — must be client-only (no SSR)
const DocumentImageViewer = dynamic(() => import("./DocumentImageViewer"), { ssr: false });
import type { FormField, FieldState } from "@/lib/ai/analyze-form";
import { getUIString } from "@/lib/i18n";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "yue", label: "廣東話" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tl", label: "Tagalog" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
] as const;

type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

function normalizeLanguageCode(language?: string | null): LanguageCode {
  if (language === "zh") return "zh-Hans";
  const matched = SUPPORTED_LANGUAGES.find((option) => option.code === language);
  return matched?.code ?? "en";
}

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
  profileCountry?: string | null;
  hasFile?: boolean;
  sourceType?: string;
}

export default function FormPageClient({ form, hasProfile, preferredLanguage, profileCountry, hasFile, sourceType }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [deleting, setDeleting] = useState(false);
  const [pageTitle, setPageTitle] = useState(form.title);
  const [formData, setFormData] = useState(form);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [liveValues, setLiveValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (form.fields as FormField[]).filter((f) => f.value).map((f) => [f.id, f.value!])
    )
  );
  const [sideBySide, setSideBySide] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("fp-side-by-side");
    if (stored === "true") setSideBySide(true);
  }, []);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [jumpToFieldRequest, setJumpToFieldRequest] = useState<{ fieldId: string; nonce: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() =>
    (form.fields as FormField[]).some((f) => f.value) ? "saved" : "idle"
  );
  const [savedAt, setSavedAt] = useState<Date | null>(() =>
    (form.fields as FormField[]).some((f) => f.value) ? new Date() : null
  );

  const handleSaveStatusChange = useCallback(
    (status: SaveStatus, ts: Date | null) => {
      setSaveStatus(status);
      if (ts) setSavedAt(ts);
    },
    []
  );

  // Check if this form has already been celebrated (prevents re-show on reload)
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem(`fp_completed_${form.id}`)) {
        // Already shown — don't show again
      }
    }
  }, [form.id]);

  const canShowDocument = hasFile && (sourceType === "PDF" || sourceType === "IMAGE");
  const documentUrl = canShowDocument ? `/api/forms/${form.id}/file` : null;

  useEffect(() => {
    setLiveValues(
      Object.fromEntries(
        (formData.fields as FormField[]).filter((f) => f.value).map((f) => [f.id, f.value!])
      )
    );
  }, [formData.fields]);

  function toggleSideBySide() {
    setSideBySide((prev) => {
      const next = !prev;
      localStorage.setItem("fp-side-by-side", String(next));
      return next;
    });
  }

  function handleDocumentFieldSelect(fieldId: string) {
    setActiveFieldId(fieldId);
    setJumpToFieldRequest({ fieldId, nonce: Date.now() });
  }
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(
    normalizeLanguageCode(preferredLanguage)
  );
  const [reExplaining, setReExplaining] = useState(false);
  const [reExplainError, setReExplainError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    setLiveValues(newValues);
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

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/forms/${form.id}/template`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create template");
      }
      const data = await res.json() as { slug: string };
      setShareSlug(data.slug);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSharing(false);
    }
  }

  function getShareUrl(slug: string) {
    return `${window.location.origin}/t/${slug}`;
  }

  async function copyShareLink() {
    if (!shareSlug) return;
    await navigator.clipboard.writeText(getShareUrl(shareSlug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this form? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete form");
      setDeleting(false);
    }
  }

  const shareModal = shareSlug ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShareSlug(null)}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Template link created</h2>
            <p className="text-sm text-slate-500 mt-0.5">Share this link. Your personal data is not included.</p>
          </div>
          <button onClick={() => setShareSlug(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={getShareUrl(shareSlug)}
            className="flex-1 text-sm px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-mono truncate"
          />
          <button
            onClick={copyShareLink}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              copied ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Anyone with this link can view the form structure and guidance. Your answers are never shared.
        </p>
      </div>
    </div>
  ) : null;

  const breadcrumb = (
    <nav className="flex items-center gap-2 text-sm mb-4 min-w-0" aria-label="Breadcrumb">
      <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
        Dashboard
      </Link>
      <svg className="w-4 h-4 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span className="font-medium text-slate-700 truncate min-w-0">{pageTitle}</span>
    </nav>
  );

  async function handleGuidedFinish() {
    // Mark form as complete (same path as the "Mark as Complete" button in FormViewer)
    await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });

    // Exit guided mode first so the overlay renders over the full form view
    setMode("full");

    // Show overlay only if not already celebrated
    if (!localStorage.getItem(`fp_completed_${form.id}`)) {
      setShowCompleteOverlay(true);
    }
  }

  if (mode === "guided") {
    return (
      <>
        {shareModal}
        {breadcrumb}
        <GuidedFillMode
          formId={form.id}
          fields={fields}
          initialValues={initialValues}
          initialStates={initialStates}
          hasProfile={hasProfile}
          onExit={() => setMode("full")}
          onFinish={handleGuidedFinish}
          onValuesChange={handleValuesChange}
        />
      </>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {shareModal}
      {breadcrumb}
      {shareError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {shareError}
        </div>
      )}
      {/* Mode toggle bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 shadow-soft px-4 py-3">
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

        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          <AutoSaveIndicator
            status={saveStatus}
            savedAt={savedAt}
            onDismissError={() => setSaveStatus("idle")}
          />

          {/* Share as Template */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[48px] md:min-h-0 text-sm font-medium rounded-lg transition-colors text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Share as Template"
          >
            {sharing ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            )}
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[48px] md:min-h-0 text-sm font-medium rounded-lg transition-colors text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Delete form"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
            {deleting ? "Deleting..." : "Delete"}
          </button>
          {canShowDocument && (
            <button
              onClick={toggleSideBySide}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                sideBySide
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title={sideBySide ? "Hide document" : "Show document side-by-side"}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
              {sideBySide ? "Hide Doc" : "Side-by-Side"}
            </button>
          )}
          <button
          onClick={() => setMode("guided")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[48px] md:min-h-0 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 16 16 12 12 8" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Start Guided Fill
        </button>
        </div>
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

      {sideBySide && documentUrl ? (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* On mobile: document viewer collapses to a thumbnail strip above fields */}
          <div className="lg:hidden">
            <DocumentImageViewer
              formId={form.id}
              sourceType={sourceType ?? "PDF"}
              fields={fields}
              activeFieldId={activeFieldId}
              liveValues={liveValues}
              onFieldSelect={handleDocumentFieldSelect}
              mobileCollapsed
              language={activeLanguage}
            />
          </div>
          {/* Left: Fields panel */}
          <div className="lg:w-1/2">
            <FormViewer
              form={formData}
              hasProfile={hasProfile}
              jumpToFieldRequest={jumpToFieldRequest}
              hasFile={hasFile}
              sourceType={sourceType}
              onFieldFocus={setActiveFieldId}
              onValueChange={(fieldId, value) =>
                setLiveValues((prev) => ({ ...prev, [fieldId]: value }))
              }
              onValuesSnapshotChange={setLiveValues}
              onTitleChange={setPageTitle}
              onComplete={() => {
                if (!localStorage.getItem(`fp_completed_${form.id}`)) {
                  setShowCompleteOverlay(true);
                }
              }}
              language={activeLanguage}
              onSaveStatusChange={handleSaveStatusChange}
            />
          </div>
          {/* Right: Document panel — sticky, desktop only */}
          <div className="hidden lg:block lg:w-1/2 lg:sticky lg:top-20 lg:self-start">
            <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden" style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-xs font-medium text-slate-600">{getUIString(activeLanguage, "originalDocument")}</span>
              </div>
            <DocumentImageViewer
              formId={form.id}
              sourceType={sourceType ?? "PDF"}
              fields={fields}
              activeFieldId={activeFieldId}
              liveValues={liveValues}
              onFieldSelect={handleDocumentFieldSelect}
              language={activeLanguage}
            />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl">
          {/* On mobile with a document, show collapsible thumbnail strip */}
          {canShowDocument && (
            <div className="md:hidden mb-4">
            <DocumentImageViewer
              formId={form.id}
              sourceType={sourceType ?? "PDF"}
              fields={fields}
              activeFieldId={activeFieldId}
              liveValues={liveValues}
              onFieldSelect={handleDocumentFieldSelect}
              mobileCollapsed
              language={activeLanguage}
            />
            </div>
          )}
          <FormViewer
            form={formData}
            hasProfile={hasProfile}
            jumpToFieldRequest={jumpToFieldRequest}
            hasFile={hasFile}
            sourceType={sourceType}
            onFieldFocus={setActiveFieldId}
            onValueChange={(fieldId, value) =>
              setLiveValues((prev) => ({ ...prev, [fieldId]: value }))
            }
            onValuesSnapshotChange={setLiveValues}
            onTitleChange={setPageTitle}
            onComplete={() => {
              if (!localStorage.getItem(`fp_completed_${form.id}`)) {
                setShowCompleteOverlay(true);
              }
            }}
            language={activeLanguage}
            onSaveStatusChange={handleSaveStatusChange}
          />
        </div>
      )}
    </div>

    {/* Form completion overlay */}
    {showCompleteOverlay && (
      <FormCompleteOverlay
        formId={form.id}
        formTitle={pageTitle}
        filledCount={(formData.fields as FormField[]).filter((f) => f.value && String(f.value).trim()).length}
        onClose={() => setShowCompleteOverlay(false)}
      />
    )}
    </>
  );
}
