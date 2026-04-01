"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PriorForm {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  completionPercent: number;
  fieldCount: number;
}

interface BillingInfo {
  plan: "free" | "pro";
  formsUsed: number;
  formsLimit: number | null;
}

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_SIZE_MB = 10;

function isImageFile(f: File): boolean {
  return f.type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(f.name);
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toUpperCase() ?? "";
}

function getFileBadge(f: File): { label: string; bg: string; text: string; border: string } {
  const ext = getFileExtension(f.name);
  if (ext === "PDF") {
    return { label: "PDF", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" };
  }
  if (ext === "DOCX" || ext === "DOC") {
    return { label: ext, bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" };
  }
  if (["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) {
    return { label: ext, bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" };
  }
  if (ext === "HEIC" || ext === "HEIF") {
    return { label: "HEIC", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" };
  }
  return { label: ext, bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  // Prior fill state
  const [priorFormId, setPriorFormId] = useState<string | null>(null);
  const [priorFormTitle, setPriorFormTitle] = useState<string | null>(null);
  const [showPriorModal, setShowPriorModal] = useState(false);
  const [priorForms, setPriorForms] = useState<PriorForm[] | null>(null);
  const [loadingPriorForms, setLoadingPriorForms] = useState(false);
  const [priorFormsCursor, setPriorFormsCursor] = useState<string | null>(null);
  const [hasMorePriorForms, setHasMorePriorForms] = useState(false);
  const [reFilling, setReFilling] = useState(false);

  // Fetch billing info once on mount for pre-flight limit check
  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBilling(data); })
      .catch(() => {});
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowUpgradeModal(false);
        setShowPriorModal(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadPriorForms(cursor?: string) {
    setLoadingPriorForms(true);
    try {
      const url = cursor ? `/api/forms?limit=10&cursor=${cursor}` : "/api/forms?limit=10";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { items: PriorForm[]; hasMore: boolean; nextCursor: string | null };
      // Only show forms that have some filled data
      const filled = data.items.filter((f) => f.completionPercent > 0);
      setPriorForms((prev) => cursor ? [...(prev ?? []), ...filled] : filled);
      setHasMorePriorForms(data.hasMore);
      setPriorFormsCursor(data.nextCursor);
    } catch {
      // silently ignore
    } finally {
      setLoadingPriorForms(false);
    }
  }

  function openPriorModal() {
    setShowPriorModal(true);
    if (!priorForms) {
      loadPriorForms();
    }
  }

  async function handleUpgrade() {
    setUpgradeLoading(true);
    const res = await fetch("/api/billing/create-checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setUpgradeLoading(false);
  }

  const isAtLimit =
    billing !== null &&
    billing.plan === "free" &&
    billing.formsLimit !== null &&
    billing.formsUsed >= billing.formsLimit;

  // Revoke object URL on cleanup to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = useCallback((f: File): string | null => {
    const isKnownMime = ACCEPTED_MIME_TYPES.has(f.type);
    const isKnownExt = /\.(pdf|doc|docx|png|jpe?g|webp|heic)$/i.test(f.name);
    if (!isKnownMime && !isKnownExt) {
      return "Please upload a PDF, Word document, or image (.png, .jpg, .jpeg, .webp, .heic)";
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File size must be under ${MAX_SIZE_MB}MB. Your file is ${(f.size / 1024 / 1024).toFixed(1)}MB.`;
    }
    return null;
  }, []);

  const applyFile = useCallback(
    (f: File) => {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      // Revoke any previous preview URL before creating a new one
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return isImageFile(f) ? URL.createObjectURL(f) : null;
      });
      setFile(f);
      setError(null);
    },
    [validateFile]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }, []);

  // Clipboard paste handler
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            applyFile(blob);
            e.preventDefault();
            break;
          }
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [applyFile]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      applyFile(droppedFile);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    // Pre-flight: show upsell modal instead of hitting the API when at limit
    if (isAtLimit) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setRetryAfter(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    // Step timers: advance through loading steps while AI processes
    const stepTimers = [
      setTimeout(() => setLoadingStep(1), 1200),
      setTimeout(() => setLoadingStep(2), 3500),
      setTimeout(() => setLoadingStep(3), 7000),
      setTimeout(() => setLoadingStep(4), 12000),
    ];
    function clearStepTimers() {
      stepTimers.forEach(clearTimeout);
    }

    // Simulate progress since fetch does not have upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return p + Math.random() * 15;
      });
    }, 300);

    try {
      const res = await fetch("/api/forms/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      clearStepTimers();

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.status === 402 && data.code === "UPGRADE_REQUIRED") {
          // Race condition: limit was hit between page load and submit
          setShowUpgradeModal(true);
          setLoading(false);
          setLoadingStep(0);
          setUploadProgress(0);
          clearInterval(progressInterval);
          return;
        }
        // Structured AI error codes from the API
        if (data.error === "rate_limited") {
          const seconds: number = typeof data.retryAfter === "number" ? data.retryAfter : 60;
          setRetryAfter(seconds);
          throw new Error(`Our AI is busy right now. Please try again in ${seconds} seconds.`);
        }
        if (data.error === "ai_unavailable") {
          throw new Error("AI analysis is temporarily unavailable. Please try again in a few minutes.");
        }
        if (data.error === "analysis_failed") {
          throw new Error("Analysis failed. Please try again or contact support.");
        }
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress(100);
      const { formId } = await res.json();

      // If user selected a prior form, map old values to new form before navigating
      if (priorFormId) {
        setReFilling(true);
        try {
          await fetch(`/api/forms/${formId}/re-fill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceFormId: priorFormId }),
          });
        } catch {
          // Non-fatal — proceed even if re-fill fails
        } finally {
          setReFilling(false);
        }
      }

      // Brief delay so user sees 100%
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push(`/dashboard/forms/${formId}`);
    } catch (err) {
      clearInterval(progressInterval);
      clearStepTimers();
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setLoadingStep(0);
      setUploadProgress(0);
    }
  }

  function handleTryAgain() {
    if (!file || loading) return;
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
    handleSubmit(syntheticEvent);
  }

  const badge = file ? getFileBadge(file) : null;
  const showImagePreview = file !== null && previewUrl !== null;

  const usagePct =
    billing && billing.formsLimit
      ? Math.min(100, (billing.formsUsed / billing.formsLimit) * 100)
      : 0;

  return (
    <div>
      {/* Prior form picker modal */}
      {showPriorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowPriorModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-card w-full max-w-lg p-6 animate-slide-down max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Choose a previous form</h2>
              <button
                onClick={() => setShowPriorModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4 shrink-0">
              We&apos;ll use your prior answers to pre-fill fields in the new form. You can review and update anything that&apos;s changed.
            </p>

            <div className="overflow-y-auto flex-1 space-y-2 min-h-0">
              {loadingPriorForms && !priorForms && (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                  <svg className="w-4 h-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Loading your forms...
                </div>
              )}
              {priorForms && priorForms.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  No previously filled forms found. Fill out a form first, then use this feature on your next one.
                </div>
              )}
              {priorForms?.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setPriorFormId(f.id);
                    setPriorFormTitle(f.title);
                    setShowPriorModal(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    priorFormId === f.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{f.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {f.fieldCount} fields &middot; {f.completionPercent}% filled &middot;{" "}
                        {new Date(f.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {priorFormId === f.id && (
                      <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
              {hasMorePriorForms && (
                <button
                  onClick={() => loadPriorForms(priorFormsCursor ?? undefined)}
                  disabled={loadingPriorForms}
                  className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                >
                  {loadingPriorForms ? "Loading..." : "Load more"}
                </button>
              )}
            </div>

            {priorFormId && (
              <div className="mt-4 pt-4 border-t border-slate-100 shrink-0 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 truncate">
                  Selected: <span className="font-medium text-slate-700">{priorFormTitle}</span>
                </p>
                <button
                  onClick={() => { setPriorFormId(null); setPriorFormTitle(null); setShowPriorModal(false); }}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors shrink-0"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-card w-full max-w-md p-6 sm:p-8 animate-slide-down"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                You&apos;ve used all {billing?.formsLimit ?? 5} free forms this month
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Upgrade to Pro for unlimited uploads and more.
              </p>
            </div>

            {/* Usage meter */}
            {billing && billing.formsLimit && (
              <div className="mb-5">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Forms used</span>
                  <span className="font-semibold">{billing.formsUsed} / {billing.formsLimit}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${usagePct}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Resets on your billing cycle.</p>
              </div>
            )}

            {/* Pro features */}
            <ul className="space-y-2 mb-6">
              {[
                "Unlimited form uploads",
                "Form Memory — learns from your completed forms",
                "Shareable form templates",
                "Priority AI processing",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="text-blue-500 shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm"
            >
              {upgradeLoading ? "Redirecting…" : "Upgrade to Pro — $9/mo"}
            </button>
            <p className="text-center mt-3 text-sm text-slate-400">
              or{" "}
              <Link href="/dashboard/billing" className="text-slate-600 underline hover:text-slate-900">
                View billing
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900">Upload Form</span>
        </div>
      </nav>

      {/* Usage warning banner for free users near/at limit */}
      {billing && billing.plan === "free" && billing.formsLimit && (
        billing.formsUsed >= billing.formsLimit ? (
          <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 py-2.5">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 text-sm">
              <span className="text-red-700 font-medium">
                You&apos;ve reached your free limit ({billing.formsUsed}/{billing.formsLimit} forms).
              </span>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-red-700 underline font-semibold shrink-0 hover:text-red-900"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        ) : billing.formsUsed >= billing.formsLimit - 1 ? (
          <div className="bg-amber-50 border-b border-amber-100 px-4 sm:px-6 py-2.5">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 text-sm">
              <span className="text-amber-700">
                {billing.formsLimit - billing.formsUsed} free form upload remaining this month.
              </span>
              <Link href="/dashboard/billing" className="text-amber-700 underline font-semibold shrink-0 hover:text-amber-900">
                View plan
              </Link>
            </div>
          </div>
        ) : null
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Upload a Form</h1>
            <p className="text-slate-500 mt-1 text-sm">
              We will parse every field, explain what to enter, and help you fill it out.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
              aria-label="Upload file area. Click or drag and drop a PDF, Word document, or image."
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-blue-500 bg-blue-50 shadow-[0_0_0_4px_rgba(37,99,235,0.1)]"
                  : file
                  ? "border-blue-300 bg-blue-50/50"
                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50/50"
              }`}
            >
              {/* Primary file input */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic,image/*"
                className="hidden"
                aria-label="Choose a PDF, Word document, or image file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyFile(f);
                }}
              />

              {/* Camera capture input (mobile) */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label="Take a photo with your camera"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyFile(f);
                }}
              />

              {file ? (
                <div className="space-y-3">
                  {showImagePreview ? (
                    /* Image thumbnail preview */
                    <div className="mx-auto overflow-hidden rounded-xl max-h-48 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Form preview"
                        className="max-h-48 max-w-full rounded-xl object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    /* Document icon for PDF/DOCX */
                    <div className="mx-auto w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                      <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <polyline points="9 15 12 12 15 15" />
                        <line x1="12" y1="12" x2="12" y2="18" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900 truncate max-w-[300px] mx-auto">
                      {file.name}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      {badge && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      )}
                      <span className="text-sm text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
                  >
                    Choose a different file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="16 16 12 12 8 16" />
                      <line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                      <polyline points="16 16 12 12 8 16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-700 font-medium">
                      <span className="text-blue-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      PDF, DOCX, PNG, JPG, WEBP, HEIC supported &middot; Max {MAX_SIZE_MB}MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera capture button (shown separately, below the drop zone) */}
            {!file && (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                aria-label="Take a photo of a paper form using your camera"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Take a photo of a paper form
              </button>
            )}

            {/* Use answers from a previous fill */}
            {priorFormId ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-sm">
                <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <polyline points="9 15 12 12 15 15" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                </svg>
                <span className="flex-1 min-w-0 text-blue-800">
                  Pre-filling from: <span className="font-medium truncate">{priorFormTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={openPriorModal}
                  className="text-blue-600 hover:text-blue-800 font-medium shrink-0 transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => { setPriorFormId(null); setPriorFormTitle(null); }}
                  className="text-blue-400 hover:text-red-600 shrink-0 transition-colors"
                  aria-label="Remove prior form selection"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openPriorModal}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Use answers from a previous fill
              </button>
            )}

            {/* Clipboard paste hint */}
            <p className="text-xs text-slate-400 text-center -mt-2">
              You can also paste a screenshot from your clipboard{" "}
              <kbd className="px-1 py-0.5 text-slate-500 bg-slate-100 border border-slate-200 rounded text-xs font-mono">Ctrl+V</kbd>
              {" / "}
              <kbd className="px-1 py-0.5 text-slate-500 bg-slate-100 border border-slate-200 rounded text-xs font-mono">Cmd+V</kbd>
            </p>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 animate-slide-down" role="alert">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-700">{error}</p>
                  {file && !retryAfter && (
                    <button
                      type="button"
                      onClick={handleTryAgain}
                      disabled={loading}
                      className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
                    >
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upload progress */}
            {loading && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-medium transition-all duration-500">
                    {reFilling
                      ? "Applying prior answers..."
                      : [
                          "Uploading file...",
                          "Parsing document...",
                          "Identifying fields...",
                          "Generating explanations...",
                          "Almost ready...",
                        ][loadingStep]}
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                        i <= loadingStep ? "bg-blue-500" : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Analyzing form...
                </span>
              ) : (
                "Analyze Form"
              )}
            </button>
          </form>

          {/* Privacy trust signals */}
          <div className="border-t border-slate-100 pt-5 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Your file is processed server-side and never stored longer than needed. Sensitive fields like SSN and passport numbers are encrypted with AES-256-GCM.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span>We never sell or share your data with third parties. Your profile data stays private to your account.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                Read our{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-600 transition-colors" rel="noopener noreferrer">
                  Privacy Policy
                </Link>{" "}
                to see exactly what we collect and why.
              </span>
            </div>
          </div>

          {/* Help text */}
          <div className="border-t border-slate-100 pt-5 space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-500">Supported formats:</span>{" "}
              PDF, Word, and images (PNG, JPG, WEBP, HEIC) &middot; Max {MAX_SIZE_MB}MB
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-500">Supported forms:</span>{" "}
              Tax forms (W-2, 1040, 1099), visa applications (DS-160, I-130),
              government paperwork, HR forms, and more. On mobile, you can take a photo of a
              paper form.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
