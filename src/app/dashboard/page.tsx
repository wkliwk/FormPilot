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
import ProfileCompletenessCard from "@/components/ProfileCompletenessCard";

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
  const [forms, allForms, profile, plan, usage, referralCode, referralStats, userRecord] = await Promise.all([
    prisma.form.findMany({
      where: { userId: session.user.id! },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1, // fetch one extra to detect hasMore
      select: {
        id: true, userId: true, title: true, status: true, sourceType: true,
        category: true, fields: true, filledData: true, shareToken: true,
        dueDate: true, notes: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.form.findMany({
      where: { userId: session.user.id! },
      select: { fields: true, status: true, shareToken: true },
    }),
    prisma.profile.findUnique({ where: { userId: session.user.id! } }),
    getUserPlan(session.user.id!),
    getOrCreateUsage(session.user.id!),
    getOrCreateReferralCode(session.user.id!),
    getReferralStats(session.user.id!),
    prisma.user.findUnique({ where: { id: session.user.id! }, select: { onboardingDismissedAt: true } }),
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

  // Step 4 done: any form exported (COMPLETED) or shared (shareToken set)
  const hasExportedOrShared = allForms.some((f) => f.status === "COMPLETED" || !!f.shareToken);

  const onboardingDismissed = !!userRecord?.onboardingDismissedAt;
  const allStepsDone = hasProfileData && pagedForms.length > 0 && hasUsedAutofill && hasExportedOrShared;

  // Show checklist until dismissed or all steps done
  const showChecklist = !onboardingDismissed && !allStepsDone;

  // Profile completeness — weighted category score
  // See ProfileCompletenessCard.tsx for the full weighting rationale.
  const pd = profileData;
  const addr = (pd?.address ?? {}) as Record<string, unknown>;

  const PROFILE_CATEGORIES = [
    { key: "identity",   name: "Name",              weight: 3, filled: !!(pd?.firstName && pd?.lastName) },
    { key: "contact",    name: "Contact info",       weight: 3, filled: !!(pd?.email && pd?.phone) },
    { key: "address",    name: "Address",            weight: 3, filled: !!(addr?.street && addr?.city && addr?.state) },
    { key: "dob",        name: "Date of birth",      weight: 2, filled: !!pd?.dateOfBirth },
    { key: "employment", name: "Employment",         weight: 2, filled: !!pd?.employerName },
    { key: "documents",  name: "Identity documents", weight: 1, filled: !!(pd?.ssn || pd?.passportNumber || pd?.driverLicense || pd?.taxId) },
  ];
  const TOTAL_WEIGHT = 14; // 3+3+3+2+2+1
  const filledWeight = PROFILE_CATEGORIES.filter((c) => c.filled).reduce((s, c) => s + c.weight, 0);
  const profileScore = Math.round((filledWeight / TOTAL_WEIGHT) * 100);

  // Top 3 missing categories by weight (highest priority first)
  const missingCategories = PROFILE_CATEGORIES
    .filter((c) => !c.filled)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => c.name);

  // Show the completeness card after the onboarding checklist is done (or dismissed) and score < 100
  const showCompletenessCard = hasProfile && profileScore < 100 && !showChecklist;

  // Keep the simpler amber nudge for non-profile users (first-time hint)
  const profileCompleteness = profileScore;
  const showProfileNudge = !hasProfile && !showChecklist;

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

  // Upcoming deadlines widget data
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = pagedForms
    .filter((f) => f.dueDate && f.status !== "COMPLETED" && new Date(f.dueDate) <= sevenDaysFromNow)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 3);

  return (
    <>
      {showChecklist && (
        <OnboardingChecklist
          hasProfileData={hasProfileData}
          formsCount={pagedForms.length}
          hasUsedAutofill={hasUsedAutofill}
          hasExportedOrShared={hasExportedOrShared}
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
                Set up your profile — it lets FormPilot autofill forms with your saved details.
              </p>
            </div>
            <Link
              href="/dashboard/profile"
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
            >
              Set up profile
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
        {/* Profile completeness card — shown when profile exists but score < 100% */}
        {showCompletenessCard && (
          <ProfileCompletenessCard score={profileScore} missingCategories={missingCategories} />
        )}

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

        {/* Upcoming deadlines widget */}
        {upcomingDeadlines.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Upcoming Deadlines</p>
            <div className="space-y-2">
              {upcomingDeadlines.map((f) => {
                const daysLeft = Math.ceil((new Date(f.dueDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                return (
                  <Link key={f.id} href={`/dashboard/forms/${f.id}`} className="flex items-center justify-between gap-3 hover:opacity-80 transition-opacity">
                    <span className="text-sm font-medium text-amber-900 truncate">{f.title}</span>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${daysLeft <= 1 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {daysLeft <= 0 ? "Overdue" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d left`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
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
                dueDate: f.dueDate ?? null,
                hasNotes: !!(f.notes?.trim()),
              };
            })}
          />
        )}
      </main>
    </>
  );
}
