import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "My Insights — FormPilot" };

const SECONDS_PER_FIELD = 45;

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  TAX: "Tax",
  IMMIGRATION: "Immigration",
  LEGAL: "Legal",
  HR_EMPLOYMENT: "HR / Employment",
  HEALTHCARE: "Healthcare",
  GENERAL: "General",
};

const CATEGORY_COLORS: Record<string, string> = {
  TAX: "bg-blue-500",
  IMMIGRATION: "bg-violet-500",
  LEGAL: "bg-emerald-500",
  HR_EMPLOYMENT: "bg-amber-500",
  HEALTHCARE: "bg-rose-500",
  GENERAL: "bg-slate-400",
};

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id!;

  const [forms, memoryRecords] = await Promise.all([
    prisma.form.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        category: true,
        autofillRate: true,
        completedAt: true,
        createdAt: true,
        fields: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.formMemory.findMany({
      where: { userId },
      select: { label: true },
      orderBy: { lastUsed: "desc" },
    }),
  ]);

  // Time saved
  let totalFieldsAutofilled = 0;
  for (const form of forms) {
    const fields = form.fields as unknown as Array<{ id: string }>;
    const fieldCount = fields?.length ?? 0;
    if (form.autofillRate && fieldCount > 0) {
      totalFieldsAutofilled += Math.round((form.autofillRate / 100) * fieldCount);
    }
  }
  const timeSavedSeconds = totalFieldsAutofilled * SECONDS_PER_FIELD;
  const timeSavedMinutes = Math.floor(timeSavedSeconds / 60);
  const timeSavedHours = Math.floor(timeSavedMinutes / 60);
  const timeSavedRemainingMinutes = timeSavedMinutes % 60;

  // Autofill accuracy trend
  const completedWithRate = forms
    .filter((f) => f.status === "COMPLETED" && f.autofillRate !== null && f.autofillRate !== undefined)
    .slice(-6);
  const avgAutofillRate = completedWithRate.length > 0
    ? Math.round(completedWithRate.reduce((sum, f) => sum + f.autofillRate!, 0) / completedWithRate.length)
    : null;
  const maxRate = completedWithRate.length > 0 ? Math.max(...completedWithRate.map((f) => f.autofillRate!)) : 100;

  // Forms by category
  const categoryMap: Record<string, number> = {};
  for (const form of forms) {
    const cat = form.category ?? "GENERAL";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const formsByCategory = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const totalCategoryForms = formsByCategory.reduce((s, c) => s + c.count, 0);

  // Streak
  const activeWeeks = new Set<string>();
  for (const form of forms) {
    activeWeeks.add(getWeekKey(form.completedAt ?? form.createdAt));
  }
  let streak = 0;
  const weekDate = new Date();
  for (let i = 0; i < 104; i++) {
    const shifted = new Date(weekDate);
    shifted.setDate(shifted.getDate() - 7 * i);
    if (activeWeeks.has(getWeekKey(shifted))) {
      streak++;
    } else {
      break;
    }
  }

  // Top field
  const labelCounts: Record<string, number> = {};
  for (const record of memoryRecords) {
    labelCounts[record.label] = (labelCounts[record.label] ?? 0) + 1;
  }
  const topFieldEntry = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0];
  const topField = topFieldEntry ? { label: topFieldEntry[0], count: topFieldEntry[1] } : null;

  const totalForms = forms.length;
  const completedForms = forms.filter((f) => f.status === "COMPLETED").length;
  const isEmpty = totalForms === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Insights</h1>
        <p className="text-sm text-slate-500 mt-1">Your FormPilot activity at a glance.</p>
      </div>

      {isEmpty ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-soft space-y-4">
          <div className="w-14 h-14 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">No data yet</p>
            <p className="text-sm text-slate-500 mt-1">Upload your first form to start tracking your stats.</p>
          </div>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Upload a form
          </Link>
        </div>
      ) : (
        <>
          {/* Top stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Forms uploaded"
              value={String(totalForms)}
            />
            <StatCard
              label="Forms completed"
              value={String(completedForms)}
            />
            <StatCard
              label="Time saved"
              value={timeSavedHours > 0
                ? `${timeSavedHours}h ${timeSavedRemainingMinutes}m`
                : `${timeSavedMinutes}m`}
              subtitle={`${totalFieldsAutofilled} fields autofilled`}
            />
            <StatCard
              label="Active weeks"
              value={streak > 0 ? String(streak) : "—"}
              subtitle={streak > 0 ? `${streak === 1 ? "week" : "weeks"} in a row` : "No streak yet"}
            />
          </div>

          {/* Autofill accuracy */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Autofill accuracy</p>
                <p className="text-xs text-slate-500 mt-0.5">How many fields FormPilot filled correctly (last 6 forms)</p>
              </div>
              {avgAutofillRate !== null && (
                <span className="text-2xl font-bold text-blue-600">{avgAutofillRate}%</span>
              )}
            </div>

            {completedWithRate.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Complete a form to see accuracy stats.</p>
            ) : (
              <div className="flex items-end gap-2 h-20">
                {completedWithRate.map((f, i) => {
                  const heightPct = maxRate > 0 ? (f.autofillRate! / maxRate) * 100 : 0;
                  return (
                    <div key={f.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-blue-500 rounded-t-md transition-all"
                        style={{ height: `${Math.max(heightPct, 8)}%` }}
                        title={`${Math.round(f.autofillRate!)}%`}
                      />
                      <span className="text-[10px] text-slate-400">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Forms by category */}
          {formsByCategory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft space-y-4">
              <p className="text-sm font-semibold text-slate-800">Forms by category</p>
              <div className="space-y-3">
                {formsByCategory.map(({ category, count }) => {
                  const pct = totalCategoryForms > 0 ? Math.round((count / totalCategoryForms) * 100) : 0;
                  const colorClass = CATEGORY_COLORS[category] ?? "bg-slate-400";
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-28 shrink-0">{CATEGORY_LABELS[category] ?? category}</span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colorClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right shrink-0">{count} form{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top field + time saved detail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topField && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Most filled field</p>
                <p className="text-lg font-bold text-slate-900 capitalize">{topField.label.replace(/_/g, " ")}</p>
                <p className="text-sm text-slate-500">Remembered from {topField.count} form{topField.count !== 1 ? "s" : ""}</p>
              </div>
            )}
            {totalFieldsAutofilled > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 shadow-soft space-y-2">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Time saved</p>
                <p className="text-lg font-bold text-slate-900">
                  {timeSavedHours > 0 ? `${timeSavedHours}h ${timeSavedRemainingMinutes}m` : `${timeSavedMinutes}m`}
                </p>
                <p className="text-sm text-slate-500">
                  {totalFieldsAutofilled} fields × 45 seconds each
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft text-center space-y-1">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
