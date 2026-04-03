"use client";

import { useState, useEffect, useCallback } from "react";
import changelog from "../../data/changelog.json";

type ChangelogEntry = {
  id: string;
  date: string;
  badge?: string;
  title: string;
  description: string;
};

const ENTRIES: ChangelogEntry[] = changelog as ChangelogEntry[];

const BADGE_COLORS: Record<string, string> = {
  New: "bg-emerald-100 text-emerald-700",
  Improved: "bg-blue-100 text-blue-700",
  Fixed: "bg-orange-100 text-orange-700",
};

function hasUnseenEntries(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return ENTRIES.length > 0;
  const lastSeen = new Date(lastSeenAt);
  return ENTRIES.some((e) => new Date(e.date) > lastSeen);
}

interface ChangelogDrawerProps {
  lastSeenChangelogAt: string | null;
}

export default function ChangelogDrawer({ lastSeenChangelogAt }: ChangelogDrawerProps) {
  const [open, setOpen] = useState(false);
  const [hasBadge, setHasBadge] = useState(() => hasUnseenEntries(lastSeenChangelogAt));

  const openDrawer = useCallback(async () => {
    setOpen(true);
    if (hasBadge) {
      setHasBadge(false);
      await fetch("/api/user/changelog-seen", { method: "PATCH" });
    }
  }, [hasBadge]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        onClick={openDrawer}
        className="relative text-sm text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 flex items-center gap-1"
        aria-label="What's new"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="hidden md:inline">What&apos;s new</span>
        {hasBadge && (
          <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-blue-500" aria-label="Unread updates" />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="What's new"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">What&apos;s new</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {ENTRIES.map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-slate-400">
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {entry.badge && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${BADGE_COLORS[entry.badge] ?? "bg-slate-100 text-slate-600"}`}>
                        {entry.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{entry.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{entry.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
