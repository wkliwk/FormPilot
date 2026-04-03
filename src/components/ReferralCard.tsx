"use client";

import { useState } from "react";

interface ReferralCardProps {
  referralCode: string;
  referralCount: number;
  bonusForms: number;
}


export default function ReferralCard({ referralCode, referralCount, bonusForms }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
  const referralUrl = `${appUrl}/?ref=${referralCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-slate-50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Refer a Friend — Get Free Forms</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Earn +1 extra form per month for each friend who signs up and uploads their first form. Max +5.
          </p>
        </div>
        {bonusForms > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
            +{bonusForms} bonus {bonusForms === 1 ? "form" : "forms"}
          </span>
        )}
      </div>

      {/* Progress */}
      {referralCount > 0 && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{referralCount}</span>{" "}
          {referralCount === 1 ? "friend" : "friends"} joined
          {bonusForms > 0 && (
            <> — you&apos;ve earned <span className="font-semibold text-blue-700">{bonusForms} bonus {bonusForms === 1 ? "form" : "forms"}</span></>
          )}
        </p>
      )}

      {/* Link copy */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 truncate select-all font-mono">
          {referralUrl}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors active:scale-[0.97]"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
