import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FormViewer from "@/components/forms/FormViewer";
import Link from "next/link";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id!) {
    notFound();
  }

  const hasProfile = !!(await prisma.profile.findUnique({
    where: { userId: session.user.id! },
  }));

  return (
    <div>
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
          ← Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900">{form.title}</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <FormViewer form={form} hasProfile={hasProfile} />
      </main>
    </div>
  );
}
