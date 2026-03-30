"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BillingInfo {
  plan: "free" | "pro";
  formsUsed: number;
  formsLimit: number | null;
  periodStart: string;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then(setBilling)
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    setActionLoading(true);
    const res = await fetch("/api/billing/create-checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setActionLoading(false);
  }

  async function handleManage() {
    setActionLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setActionLoading(false);
  }

  const usagePct =
    billing && billing.formsLimit
      ? Math.min(100, (billing.formsUsed / billing.formsLimit) * 100)
      : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900">Billing &amp; Plan</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Billing &amp; Plan</h1>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="bg-slate-100 rounded-2xl h-28" />
            <div className="bg-slate-100 rounded-2xl h-20" />
          </div>
        ) : billing ? (
          <div className="space-y-6">
            {/* Plan card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  Current plan
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900 capitalize">
                    {billing.plan}
                  </span>
                  {billing.plan === "pro" && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                {billing.plan === "free" && (
                  <p className="text-sm text-slate-500 mt-1">
                    Upgrade to Pro for unlimited forms, form memory, and shared templates.
                  </p>
                )}
              </div>
              <div>
                {billing.plan === "free" ? (
                  <button
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Redirecting…" : "Upgrade to Pro — $9/mo"}
                  </button>
                ) : (
                  <button
                    onClick={handleManage}
                    disabled={actionLoading}
                    className="border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading ? "Redirecting…" : "Manage subscription"}
                  </button>
                )}
              </div>
            </div>

            {/* Usage meter (free only) */}
            {billing.plan === "free" && billing.formsLimit && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    Forms used this month
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {billing.formsUsed} / {billing.formsLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usagePct >= 100
                        ? "bg-red-500"
                        : usagePct >= 80
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                {billing.formsUsed >= billing.formsLimit && (
                  <p className="text-sm text-red-600">
                    You&apos;ve reached your free limit.{" "}
                    <button
                      onClick={handleUpgrade}
                      className="underline font-medium"
                    >
                      Upgrade to Pro
                    </button>{" "}
                    for unlimited forms.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Resets on your billing cycle.
                </p>
              </div>
            )}

            {/* Pro features list */}
            {billing.plan === "free" && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Pro includes
                </h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {[
                    "Unlimited form uploads",
                    "Form Memory — learns from your completed forms",
                    "Shareable form templates",
                    "Priority AI processing",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-blue-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleUpgrade}
                  disabled={actionLoading}
                  className="mt-4 w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? "Redirecting…" : "Get Pro — $9/month"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Failed to load billing info.</p>
        )}
      </main>
    </div>
  );
}
