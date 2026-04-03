import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/forms/ProfileForm";
import SavedCorrections from "@/components/forms/SavedCorrections";
import ImportedBanner from "@/components/forms/ImportedBanner";
import ProfileQuickFillModal from "@/components/forms/ProfileQuickFillModal";
import Link from "next/link";
import { Suspense } from "react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [profile, corrections] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id! } }),
    prisma.formMemory.findMany({
      where: { userId: session.user.id!, fieldType: "correction" },
      orderBy: { lastUsed: "desc" },
      select: { id: true, label: true, value: true, lastUsed: true },
    }),
  ]);

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
          <span className="font-medium text-slate-900">My Profile</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Suspense fallback={null}>
          <ImportedBanner />
        </Suspense>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Profile Vault</h1>
              <p className="text-slate-500 mt-1 text-sm">
                Store your personal data once. FormPilot uses it to autofill forms -- never shared with third parties.
              </p>
            </div>
            <ProfileQuickFillModal />
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <p className="text-sm text-amber-800">
              Your data is encrypted at rest and used only for autofill within your account.
              We never send it to external services.
            </p>
          </div>

          <ProfileForm
            initialData={profile?.data as Record<string, unknown> | null}
            initialPreferredLanguage={profile?.preferredLanguage ?? null}
          />
        </div>

        {corrections.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 sm:p-8 mt-6">
            <SavedCorrections initialCorrections={corrections} />
          </div>
        )}
      </main>
    </div>
  );
}
