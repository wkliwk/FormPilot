"use client";

import { useState } from "react";

interface ShareModalProps {
  formId: string;
  onClose: () => void;
}

export default function ShareModal({ formId, onClose }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${formId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate link");
      const data = await res.json();
      setShareUrl(data.url);
    } catch {
      setError("Could not generate share link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function revokeLink() {
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${formId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke link");
      setShareUrl(null);
    } catch {
      setError("Could not revoke link. Please try again.");
    } finally {
      setRevoking(false);
    }
  }

  async function copyToClipboard() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Share form field guide"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Share field guide</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-5">
            <p className="text-sm text-slate-500 mb-4">
              Share AI field explanations with anyone — without sharing your filled values or personal data.
            </p>

            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

            {!shareUrl ? (
              <button
                onClick={generateLink}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Generating link…" : "Generate share link"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  onClick={revokeLink}
                  disabled={revoking}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {revoking ? "Revoking…" : "Revoke link"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
