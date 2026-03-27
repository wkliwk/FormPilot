import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const forms = await prisma.form.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">My Forms</h1>
          <Link
            href="/dashboard/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Upload Form
          </Link>
        </div>

        {forms.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
            <div className="text-5xl">📋</div>
            <p className="text-slate-600">No forms yet. Upload your first form to get started.</p>
            <Link
              href="/dashboard/upload"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Upload a Form
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <Link
                key={form.id}
                href={`/dashboard/forms/${form.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{form.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {form.sourceType} · {new Date(form.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      form.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : form.status === "FILLING"
                        ? "bg-blue-100 text-blue-700"
                        : form.status === "ANALYZED"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {form.status.toLowerCase()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

