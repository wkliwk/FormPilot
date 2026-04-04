"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  phUrl: string | null;
}

const DISMISS_KEY = "ph_notify_dismissed";
const UPVOTE_KEY = "ph_upvote_clicked";
const DISMISS_DAYS = 30;

function isDismissed(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const { until } = JSON.parse(raw) as { until: number };
    return Date.now() < until;
  } catch {
    return false;
  }
}

function setDismissed(key: string, days: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ until: Date.now() + days * 86400_000 }));
  } catch {
    // localStorage unavailable — ignore
  }
}

export default function LaunchBanner({ phUrl }: Props) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phUrl) {
      // Launch-day mode: show orange upvote banner unless already clicked
      setVisible(!isDismissed(UPVOTE_KEY));
    } else {
      // Pre-launch mode: show notify-me banner unless dismissed
      setVisible(!isDismissed(DISMISS_KEY));
    }
  }, [phUrl]);

  if (!visible) return null;

  function handleDismiss() {
    setDismissed(phUrl ? UPVOTE_KEY : DISMISS_KEY, DISMISS_DAYS);
    setVisible(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/launch-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "landing" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  // Launch-day: orange upvote banner
  if (phUrl) {
    return (
      <div className="relative z-40 bg-[#da552f] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3 text-sm font-medium">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.8S14.6 8.4 13.604 8.4z" />
            <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.604 14.4h-3.405V18H7.8V6h5.804a4.2 4.2 0 010 8.4z" clipRule="evenodd" />
          </svg>
          <span>We&apos;re live on Product Hunt today!</span>
          <a
            href={phUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setDismissed(UPVOTE_KEY, DISMISS_DAYS);
              setVisible(false);
            }}
            className="underline underline-offset-2 font-semibold hover:opacity-90 transition-opacity"
          >
            Upvote us &rarr;
          </a>
        </div>
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  // Pre-launch: notify-me banner
  return (
    <div className="relative z-40 bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-3">
        <span className="text-sm font-medium text-slate-200 shrink-0">
          FormPilot is launching on Product Hunt — get notified on launch day.
        </span>
        {status === "done" ? (
          <span className="text-sm font-semibold text-emerald-400">
            ✓ You&apos;re on the list!
          </span>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="h-8 px-3 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 border-0 outline-none focus:ring-2 focus:ring-blue-400 w-48"
              aria-label="Email address"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="h-8 px-4 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0"
            >
              {status === "loading" ? "…" : "Notify me"}
            </button>
          </form>
        )}
        {status === "error" && (
          <span className="text-xs text-rose-400">{errorMsg}</span>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
