import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FormCardList from "@/components/forms/FormCardList";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const forms = await prisma.form.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const stats = {
    total: forms.length,
    completed: forms.filter((f) => f.status === "COMPLETED").length,
    inProgress: forms.filter((f) => f.status === "FILLING").length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
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
      {forms.length === 0 ? (
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
          <h2 className="text-lg font-semibold text-slate-900">No forms yet</h2>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto text-sm">
            Upload your first PDF or Word form. We will analyze every field and explain
            what to enter in plain language.
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
        <FormCardList forms={forms.map((f) => ({
          id: f.id,
          title: f.title,
          status: f.status,
          sourceType: f.sourceType,
          createdAt: f.createdAt,
        }))} />
      )}
    </main>
  );
}
