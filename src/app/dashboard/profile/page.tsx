import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/forms/ProfileForm";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id! },
  });

  return (
    <div>
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
          ← Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900">My Profile</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Profile Vault</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Store your personal data once. FormPilot uses it to autofill forms — never shared with third parties.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            Your data is encrypted at rest and used only for autofill within your account.
            We never send it to external services.
          </div>

          <ProfileForm initialData={profile?.data as Record<string, unknown> | null} />
        </div>
      </main>
    </div>
  );
}
