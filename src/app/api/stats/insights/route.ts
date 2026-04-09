import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 45 seconds per field is the industry average for manual form filling
const SECONDS_PER_FIELD = 45;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

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
      select: { label: true, value: true, fieldType: true },
      orderBy: { lastUsed: "desc" },
    }),
  ]);

  // --- Time saved ---
  // Sum autofilled fields across all forms (autofillRate × field count)
  let totalFieldsAutofilled = 0;
  for (const form of forms) {
    const fields = form.fields as unknown as Array<{ id: string; value?: string }>;
    const fieldCount = fields?.length ?? 0;
    if (form.autofillRate && fieldCount > 0) {
      totalFieldsAutofilled += Math.round((form.autofillRate / 100) * fieldCount);
    }
  }
  const timeSavedSeconds = totalFieldsAutofilled * SECONDS_PER_FIELD;
  const timeSavedMinutes = Math.floor(timeSavedSeconds / 60);
  const timeSavedHours = Math.floor(timeSavedMinutes / 60);
  const timeSavedRemainingMinutes = timeSavedMinutes % 60;

  // --- Autofill accuracy trend (last 6 completed forms with autofillRate) ---
  const completedWithRate = forms
    .filter((f) => f.status === "COMPLETED" && f.autofillRate !== null && f.autofillRate !== undefined)
    .slice(-6)
    .map((f) => ({
      id: f.id,
      rate: Math.round(f.autofillRate!),
      completedAt: f.completedAt?.toISOString() ?? f.createdAt.toISOString(),
    }));

  const avgAutofillRate = completedWithRate.length > 0
    ? Math.round(completedWithRate.reduce((sum, f) => sum + f.rate, 0) / completedWithRate.length)
    : null;

  // --- Forms by category ---
  const categoryMap: Record<string, number> = {};
  for (const form of forms) {
    const cat = form.category ?? "GENERAL";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const formsByCategory = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // --- Active weeks streak ---
  // Get all weeks (Mon–Sun) where at least one form was created or completed
  const activeWeeks = new Set<string>();
  for (const form of forms) {
    const date = form.completedAt ?? form.createdAt;
    const weekKey = getWeekKey(date);
    activeWeeks.add(weekKey);
  }

  // Count consecutive weeks up to today
  let streak = 0;
  const today = new Date();
  let weekDate = new Date(today);
  while (true) {
    const key = getWeekKey(weekDate);
    if (activeWeeks.has(key)) {
      streak++;
      weekDate.setDate(weekDate.getDate() - 7);
    } else {
      break;
    }
    if (streak > 104) break; // cap at 2 years
  }

  // --- Top field from FormMemory ---
  // Most commonly used field label (proxy: most frequently occurring label in memory)
  const labelCounts: Record<string, number> = {};
  for (const record of memoryRecords) {
    labelCounts[record.label] = (labelCounts[record.label] ?? 0) + 1;
  }
  const topFieldEntry = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0];
  const topField = topFieldEntry
    ? { label: topFieldEntry[0], count: topFieldEntry[1] }
    : null;

  // --- Summary counts ---
  const totalForms = forms.length;
  const completedForms = forms.filter((f) => f.status === "COMPLETED").length;

  return NextResponse.json({
    totalForms,
    completedForms,
    timeSaved: {
      hours: timeSavedHours,
      minutes: timeSavedRemainingMinutes,
      totalMinutes: timeSavedMinutes,
      fieldsAutofilled: totalFieldsAutofilled,
    },
    autofillAccuracy: {
      average: avgAutofillRate,
      trend: completedWithRate,
    },
    formsByCategory,
    activeWeeksStreak: streak,
    topField,
  });
}

/** Returns an ISO week key like "2026-W14" for a given date */
function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // treat Sunday as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
