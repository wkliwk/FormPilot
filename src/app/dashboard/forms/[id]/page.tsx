import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FormPageClient from "@/components/forms/FormPageClient";
import Link from "next/link";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id!) {
    notFound();
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id! },
    select: { id: true, preferredLanguage: true },
  });

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900 truncate max-w-[300px]">
            {form.title}
          </span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <FormPageClient
          form={form}
          hasProfile={!!profile}
          preferredLanguage={profile?.preferredLanguage ?? null}
        />
      </main>
    </div>
  );
}
