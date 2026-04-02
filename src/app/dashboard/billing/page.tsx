"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BillingInfo {
  plan: "free" | "pro";
  formsUsed: number;
  formsLimit: number | null;
  periodStart: string;
}

type PlanChoice = "monthly" | "annual";

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>("annual");

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then(setBilling)
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: PlanChoice = selectedPlan) {
    setActionLoading(true);
    const res = await fetch(`/api/billing/create-checkout?plan=${plan}`, { method: "POST" });
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
            {/* Current plan card */}
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
                    onClick={() => handleUpgrade()}
                    disabled={actionLoading}
                    className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Redirecting…" : "Upgrade to Pro"}
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

            {/* Plan picker (free users only) */}
            {billing.plan === "free" && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Choose your plan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Monthly */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("monthly")}
                    className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
                      selectedPlan === "monthly"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-700 mb-1">Monthly</div>
                    <div className="text-2xl font-bold text-slate-900">$9<span className="text-sm font-normal text-slate-500">/mo</span></div>
                    <div className="text-xs text-slate-400 mt-1">Billed monthly · cancel anytime</div>
                    {selectedPlan === "monthly" && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Annual */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("annual")}
                    className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
                      selectedPlan === "annual"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-700">Annual</span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Best value — save 27%</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">$79<span className="text-sm font-normal text-slate-500">/yr</span></div>
                    <div className="text-xs text-slate-400 mt-1">$6.58/mo · billed annually</div>
                    {selectedPlan === "annual" && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

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
                      onClick={() => handleUpgrade()}
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
                  onClick={() => handleUpgrade()}
                  disabled={actionLoading}
                  className="mt-4 w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading
                    ? "Redirecting…"
                    : selectedPlan === "annual"
                    ? "Get Pro — $79/year"
                    : "Get Pro — $9/month"}
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
