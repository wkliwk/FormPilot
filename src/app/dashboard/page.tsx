import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import FormCardList from "@/components/forms/FormCardList";
import DashboardEmptyState from "@/components/forms/DashboardEmptyState";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import DashboardStats from "@/components/DashboardStats";
import QuotaBar from "@/components/QuotaBar";
import UpgradeNudgeBanner from "@/components/UpgradeNudgeBanner";
import ProGateModal from "@/components/ProGateModal";
import ReferralCard from "@/components/ReferralCard";
import { getUserPlan, getOrCreateUsage, FREE_FORM_LIMIT } from "@/lib/subscription";
import { getUserByReferralCode, getOrCreateReferralCode, getReferralStats } from "@/lib/referral";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Apply referral code from cookie if not yet set (best-effort, non-blocking for page render)
  try {
    const cookieStore = await cookies();
    const refCode = cookieStore.get("fp_ref")?.value;
    if (refCode) {
      const userRecord = await prisma.user.findUnique({
        where: { id: session.user.id! },
        select: { referredBy: true },
      });
      if (!userRecord?.referredBy) {
        const referrerId = await getUserByReferralCode(refCode);
        if (referrerId && referrerId !== session.user.id) {
          await prisma.user.update({
            where: { id: session.user.id! },
            data: { referredBy: referrerId },
          });
        }
      }
    }
  } catch {
    // Non-blocking — referral tracking failure must not break dashboard
  }

  const PAGE_SIZE = 20;
  const [forms, allForms, profile, plan, usage, referralCode, referralStats] = await Promise.all([
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
    getOrCreateReferralCode(session.user.id!),
    getReferralStats(session.user.id!),
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
      {plan !== "pro" && (
        <UpgradeNudgeBanner
          formsUsed={usage.formsThisMonth}
          limit={FREE_FORM_LIMIT}
        />
      )}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Stats widget — only shown after first form is used */}
        {allForms.length > 0 && <DashboardStats {...dashboardStats} />}

        {/* Referral card — free users only */}
        {plan !== "pro" && (
          <ReferralCard
            referralCode={referralCode}
            referralCount={referralStats.count}
            bonusForms={referralStats.bonusForms}
          />
        )}

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
          <div className="flex items-center gap-2">
            <ProGateModal
              feature="Batch Fill"
              benefit="Upload and auto-fill up to 10 forms at once. Save hours on repetitive paperwork."
              isPro={plan === "pro"}
            >
              <Link
                href="/dashboard/batch"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                Batch Fill
              </Link>
            </ProGateModal>
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
        </div>

        {/* Content */}
        {pagedForms.length === 0 ? (
          <DashboardEmptyState />
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
