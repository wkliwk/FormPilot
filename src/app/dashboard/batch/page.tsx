"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import JSZip from "jszip";

const MAX_FILES = 10;
const MAX_SIZE_MB = 10;

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

type BatchStatus = "queued" | "uploading" | "autofilling" | "complete" | "error";

interface BatchFile {
  clientId: string;
  file: File;
  status: BatchStatus;
  formId?: string;
  title?: string;
  fieldCount?: number;
  autofillCount?: number;
  error?: string;
}

interface BillingInfo {
  plan: "free" | "pro";
}

function statusLabel(s: BatchStatus): string {
  switch (s) {
    case "queued": return "Queued";
    case "uploading": return "Uploading & analyzing...";
    case "autofilling": return "Autofilling...";
    case "complete": return "Complete";
    case "error": return "Failed";
  }
}

function statusColor(s: BatchStatus): string {
  switch (s) {
    case "queued": return "text-slate-400";
    case "uploading": return "text-blue-600";
    case "autofilling": return "text-violet-600";
    case "complete": return "text-green-600";
    case "error": return "text-red-500";
  }
}

function statusDot(s: BatchStatus): string {
  switch (s) {
    case "queued": return "bg-slate-300";
    case "uploading": return "bg-blue-500 animate-pulse";
    case "autofilling": return "bg-violet-500 animate-pulse";
    case "complete": return "bg-green-500";
    case "error": return "bg-red-500";
  }
}

let clientIdCounter = 0;
function nextId(): string {
  return String(++clientIdCounter);
}

export default function BatchPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBilling(data); })
      .catch(() => {});
  }, []);

  const isPro = billing?.plan === "pro";
  const completedForms = batchFiles.filter((f) => f.status === "complete" && f.formId);

  function validateFile(f: File): string | null {
    const isKnownMime = ACCEPTED_MIME_TYPES.has(f.type);
    const isKnownExt = /\.(pdf|doc|docx|png|jpe?g|webp|heic)$/i.test(f.name);
    if (!isKnownMime && !isKnownExt) {
      return `${f.name}: unsupported format`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `${f.name}: file too large (max ${MAX_SIZE_MB}MB)`;
    }
    return null;
  }

  const addFiles = useCallback((files: File[]) => {
    const remaining = MAX_FILES - batchFiles.length;
    if (remaining <= 0) {
      setGlobalError(`Maximum ${MAX_FILES} files per batch.`);
      return;
    }
    const toAdd = files.slice(0, remaining);
    const errors: string[] = [];
    const valid: BatchFile[] = [];
    for (const f of toAdd) {
      const err = validateFile(f);
      if (err) { errors.push(err); continue; }
      valid.push({ clientId: nextId(), file: f, status: "queued" });
    }
    if (errors.length > 0) setGlobalError(errors.join(" · "));
    else setGlobalError(null);
    if (valid.length > 0) {
      setBatchFiles((prev) => [...prev, ...valid]);
    }
  }, [batchFiles.length]);

  function removeFile(clientId: string) {
    setBatchFiles((prev) => prev.filter((f) => f.clientId !== clientId));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = "";
  }

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
    addFiles(Array.from(e.dataTransfer.files));
  }

  function updateFile(clientId: string, patch: Partial<BatchFile>) {
    setBatchFiles((prev) => prev.map((f) => f.clientId === clientId ? { ...f, ...patch } : f));
  }

  async function runBatch() {
    if (running || batchFiles.length === 0) return;
    setRunning(true);
    setDone(false);
    setGlobalError(null);

    // Process sequentially to avoid rate limits
    for (const bf of batchFiles) {
      if (bf.status === "complete") continue; // skip already-done on retry

      updateFile(bf.clientId, { status: "uploading", error: undefined });

      try {
        // Step 1: Upload
        const fd = new FormData();
        fd.append("file", bf.file);
        const uploadRes = await fetch("/api/forms/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          if (uploadRes.status === 402) {
            updateFile(bf.clientId, { status: "error", error: "Usage limit reached — upgrade to Pro" });
            continue;
          }
          updateFile(bf.clientId, { status: "error", error: data.error ?? "Upload failed" });
          continue;
        }
        const { formId } = await uploadRes.json();

        // Step 2: Autofill
        updateFile(bf.clientId, { status: "autofilling", formId });
        const fillRes = await fetch(`/api/forms/${formId}/autofill`, { method: "POST" });

        // Fetch form title + field counts regardless of autofill result
        const formRes = await fetch(`/api/forms/${formId}`);
        let title = bf.file.name;
        let fieldCount = 0;
        let autofillCount = 0;
        if (formRes.ok) {
          const { form: formData } = await formRes.json();
          title = formData.title ?? title;
          const fields: Array<{ value?: string }> = formData.fields ?? [];
          fieldCount = fields.length;
          autofillCount = fillRes.ok
            ? fields.filter((f) => f.value && String(f.value).trim()).length
            : 0;
        }

        updateFile(bf.clientId, {
          status: "complete",
          formId,
          title,
          fieldCount,
          autofillCount,
        });
      } catch {
        updateFile(bf.clientId, { status: "error", error: "Network error — try again" });
      }
    }

    setRunning(false);
    setDone(true);
  }

  async function downloadZip() {
    if (completedForms.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      await Promise.allSettled(
        completedForms.map(async (bf) => {
          const res = await fetch(`/api/forms/${bf.formId}/export?force=true`);
          if (!res.ok) return;
          const blob = await res.blob();
          const contentType = res.headers.get("content-type") ?? "";
          const ext = contentType.includes("pdf") ? "pdf" : "json";
          const safeName = (bf.title ?? bf.formId ?? "form").replace(/[^a-z0-9]/gi, "_");
          zip.file(`${safeName}_filled.${ext}`, blob);
        })
      );
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "formpilot_batch.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }

  function reset() {
    setBatchFiles([]);
    setDone(false);
    setGlobalError(null);
  }

  const allQueued = batchFiles.every((f) => f.status === "queued");
  const hasErrors = batchFiles.some((f) => f.status === "error");

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900">Batch Fill</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Batch Fill</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
              Pro
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Upload up to {MAX_FILES} forms at once. FormPilot autofills each one from your profile in sequence.
          </p>
        </div>

        {/* Pro gate banner for free users */}
        {billing !== null && !isPro && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-violet-900 text-sm">Batch Fill is a Pro feature</p>
              <p className="text-violet-700 text-sm mt-0.5">
                Fill up to 10 forms at once — perfect for job hunting, visa season, or tax time.
              </p>
            </div>
            <a
              href="/dashboard/billing"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        )}

        <div className={billing !== null && !isPro ? "opacity-60 pointer-events-none select-none" : ""}>
          {/* Drop zone */}
          {!running && !done && (
            <div
              className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
                isDragging
                  ? "border-violet-400 bg-violet-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              aria-label="Select forms to batch fill"
            >
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <svg className="w-10 h-10 text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="font-medium text-slate-700 text-sm">
                  {batchFiles.length === 0
                    ? "Click to select forms, or drag & drop"
                    : `Add more (${batchFiles.length}/${MAX_FILES} selected)`}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PNG, JPG, WEBP · Max {MAX_SIZE_MB}MB each</p>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic"
            onChange={handleFileInput}
          />

          {globalError && (
            <p className="text-sm text-red-600 mt-2">{globalError}</p>
          )}

          {/* File list */}
          {batchFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {batchFiles.map((bf) => (
                <div
                  key={bf.clientId}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white"
                >
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(bf.status)}`} />

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {bf.title ?? bf.file.name}
                    </p>
                    <p className={`text-xs mt-0.5 ${statusColor(bf.status)}`}>
                      {statusLabel(bf.status)}
                      {bf.status === "complete" && bf.fieldCount !== undefined && (
                        <> · {bf.autofillCount}/{bf.fieldCount} fields autofilled</>
                      )}
                      {bf.status === "error" && bf.error && (
                        <> · {bf.error}</>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {bf.status === "complete" && bf.formId && (
                      <Link
                        href={`/dashboard/forms/${bf.formId}`}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                      >
                        Review
                      </Link>
                    )}
                    {(bf.status === "queued" || bf.status === "error") && !running && (
                      <button
                        type="button"
                        onClick={() => removeFile(bf.clientId)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        aria-label={`Remove ${bf.file.name}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action row */}
          {batchFiles.length > 0 && !done && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={runBatch}
                disabled={running || batchFiles.length === 0}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? "Filling forms..." : `Fill ${batchFiles.length} Form${batchFiles.length === 1 ? "" : "s"}`}
              </button>
              {!running && allQueued && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">
                    {completedForms.length} of {batchFiles.length} form{batchFiles.length === 1 ? "" : "s"} filled
                    {hasErrors && ` · ${batchFiles.filter((f) => f.status === "error").length} failed`}
                  </p>
                  {hasErrors && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Remove failed files and retry, or review them individually.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {completedForms.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadZip}
                      disabled={zipping}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {zipping ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          Preparing ZIP...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download all as ZIP
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={reset}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    New batch
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="text-xs text-slate-400 space-y-1">
          <p>· Each form counts as 1 usage unit toward your monthly quota.</p>
          <p>· Forms are processed one at a time to ensure accuracy.</p>
          <p>· ZIP download includes PDF for PDF forms, JSON summary for others.</p>
        </div>
      </main>
    </div>
  );
}
