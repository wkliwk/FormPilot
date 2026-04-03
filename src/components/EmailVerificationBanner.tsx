"use client";

import { useState, useEffect } from "react";

export default function EmailVerificationBanner() {
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verifyResult, setVerifyResult] = useState<"success" | "expired" | "invalid" | null>(null);

  useEffect(() => {
    // Handle redirect feedback from /api/auth/verify-email
    const params = new URLSearchParams(window.location.search);
    const v = params.get("verify");
    if (v === "success" || v === "expired" || v === "invalid") {
      setVerifyResult(v);
      // Remove param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("verify");
      window.history.replaceState({}, "", url.toString());
      if (v === "success") {
        // Auto-dismiss success after 4s
        setTimeout(() => setVerifyResult(null), 4000);
        return;
      }
    }

    // Check if already dismissed this session
    if (sessionStorage.getItem("fp-verify-banner-dismissed")) return;

    fetch("/api/auth/verify-status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.verified) setVisible(true);
      })
      .catch(() => {
        // silently ignore — banner is non-critical
      });
  }, []);

  function dismiss() {
    sessionStorage.setItem("fp-verify-banner-dismissed", "1");
    setVisible(false);
  }

  async function resend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to send. Try again later.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (verifyResult === "success") {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
        <svg className="shrink-0 text-green-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Email verified — your account is fully active.
      </div>
    );
  }

  if (verifyResult === "expired" || verifyResult === "invalid") {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
        <span className="flex-1 text-red-800">
          {verifyResult === "expired" ? "Verification link expired." : "Invalid verification link."}{" "}
          Request a new one below.
        </span>
        <button onClick={resend} disabled={sending} className="text-red-700 font-medium hover:text-red-900 disabled:opacity-50">
          {sending ? "Sending…" : "Resend"}
        </button>
        <button onClick={() => setVerifyResult(null)} className="text-red-400 hover:text-red-600 ml-1" aria-label="Dismiss">✕</button>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <svg
        className="shrink-0 text-amber-500"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      <span className="flex-1 text-amber-800">
        {sent ? (
          "Verification email sent — check your inbox."
        ) : (
          <>
            Please verify your email to unlock all features.{" "}
            {error && <span className="text-red-600">{error}</span>}
          </>
        )}
      </span>
      {!sent && (
        <button
          onClick={resend}
          disabled={sending}
          className="text-amber-700 font-medium hover:text-amber-900 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Resend"}
        </button>
      )}
      <button
        onClick={dismiss}
        className="text-amber-400 hover:text-amber-600 ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
