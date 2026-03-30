import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FormCardList from "@/components/forms/FormCardList";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import DashboardStats from "@/components/DashboardStats";
import QuotaBar from "@/components/QuotaBar";
import { getUserPlan, getOrCreateUsage, FREE_FORM_LIMIT } from "@/lib/subscription";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const PAGE_SIZE = 20;
  const [forms, allForms, profile, plan, usage] = await Promise.all([
    prisma.form.findMany({
      where: { userId: session.user.id! },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1, // fetch one extra to detect hasMore
    }),
    prisma.form.findMany({
      where: { userId: session.user.id! },
      select: { fields: true, status: true },
    }),
    prisma.profile.findUnique({ where: { userId: session.user.id! } }),
    getUserPlan(session.user.id!),
    getOrCreateUsage(session.user.id!),
  ]);
  const hasMore = forms.length > PAGE_SIZE;
  const pagedForms = hasMore ? forms.slice(0, PAGE_SIZE) : forms;

  const hasProfile = !!profile;

  // Step 1 done: profile exists with at least firstName + email
  const profileData = profile?.data as Record<string, unknown> | undefined;
  const hasProfileData =
    hasProfile &&
    !!profileData?.firstName &&
    !!profileData?.email;

  // Step 3 done: any form has been through analysis/autofill
  const hasUsedAutofill = pagedForms.some((f) => f.status !== "PENDING");

  // Show checklist until all 3 steps done + dismissed
  const showChecklist = !hasProfileData || pagedForms.length === 0 || !hasUsedAutofill;

  // Profile completeness for nudge (10 core fields)
  const pd = profileData;
  const addr = (pd?.address ?? {}) as Record<string, unknown>;
  const coreFields = [
    pd?.firstName, pd?.lastName, pd?.email, pd?.phone, pd?.dateOfBirth,
    addr?.street, addr?.city, addr?.state, addr?.zip, addr?.country,
  ];
  const profileCompleteness = Math.round(
    (coreFields.filter((v) => v && String(v).trim()).length / coreFields.length) * 100
  );
  const showProfileNudge = hasProfileData && profileCompleteness < 60 && !showChecklist;

  const stats = {
    total: pagedForms.length,
    completed: pagedForms.filter((f) => f.status === "COMPLETED").length,
    inProgress: pagedForms.filter((f) => f.status === "FILLING").length,
  };

  // Stats widget data — computed from ALL forms (not just paged)
  const SECONDS_SAVED_PER_FIELD = 45;
  const totalFieldsFilled = allForms.reduce((sum, f) => {
    const fields = f.fields as Array<{ value?: string }>;
    return sum + fields.filter((field) => field.value && String(field.value).trim()).length;
  }, 0);
  const totalTimeSavedSeconds = totalFieldsFilled * SECONDS_SAVED_PER_FIELD;
  const formsCompleted = allForms.filter((f) => f.status === "COMPLETED").length;

  const dashboardStats = {
    totalFieldsFilled,
    totalTimeSavedSeconds,
    formsCompleted,
    isPro: plan === "pro",
    formsUsedThisMonth: usage.formsThisMonth,
    freeFormLimit: FREE_FORM_LIMIT,
  };

  return (
    <>
      {showChecklist && (
        <OnboardingChecklist
          hasProfileData={hasProfileData}
          formsCount={pagedForms.length}
          hasUsedAutofill={hasUsedAutofill}
        />
      )}
      {showProfileNudge && (
        <div className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-amber-800">
                Your profile is <strong>{profileCompleteness}% complete</strong> — add more details to improve autofill accuracy.
              </p>
            </div>
            <Link
              href="/dashboard/profile"
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
            >
              Complete profile
            </Link>
          </div>
        </div>
      )}
      {pagedForms.length > 0 && (
        <QuotaBar
          formsUsed={usage.formsThisMonth}
          limit={FREE_FORM_LIMIT}
          isPro={plan === "pro"}
        />
      )}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Stats widget — only shown after first form is used */}
        {allForms.length > 0 && <DashboardStats {...dashboardStats} />}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Forms</h1>
            {forms.length > 0 && (
              <p className="text-sm text-slate-400 mt-1">
                {stats.total} form{stats.total !== 1 ? "s" : ""}
                {stats.completed > 0 && <span> &middot; {stats.completed} completed</span>}
                {stats.inProgress > 0 && <span> &middot; {stats.inProgress} in progress</span>}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Upload Form
          </Link>
        </div>

        {/* Content */}
        {pagedForms.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-12 sm:p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Fill your first form</h2>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto text-sm">
              Upload any PDF, Word doc, or photo of a paper form — FormPilot will explain every field and help you fill it.
            </p>
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Upload a Form
            </Link>
          </div>
        ) : (
          <FormCardList
            initialHasMore={hasMore}
            forms={pagedForms.map((f) => {
              const fields = f.fields as Array<{ value?: string }>;
              const totalFields = fields.length;
              const filledCount = fields.filter((field) => field.value && String(field.value).trim()).length;
              const completionPercent = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;
              return {
                id: f.id,
                title: f.title,
                status: f.status,
                sourceType: f.sourceType,
                category: f.category ?? null,
                fieldCount: totalFields,
                completionPercent,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
              };
            })}
          />
        )}
      </main>
    </>
  );
}
