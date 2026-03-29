import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FormMemoryClient from "@/components/FormMemoryClient";

export const metadata = { title: "Form Memory — FormPilot" };

const FIELD_TYPE_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  employer: "Employment",
  passport: "Travel / ID",
  tax_id: "Tax / Finance",
  custom: "Other",
};

export default async function MemoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const records = await prisma.formMemory.findMany({
    where: { userId: session.user.id! },
    orderBy: { lastUsed: "desc" },
    select: {
      id: true,
      fieldType: true,
      label: true,
      value: true,
      confidence: true,
      sourceTitle: true,
      lastUsed: true,
    },
  });

  // Group by fieldType
  const grouped: Record<string, typeof records> = {};
  for (const record of records) {
    const key = record.fieldType in FIELD_TYPE_LABELS ? record.fieldType : "custom";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(record);
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            Dashboard
          </Link>
          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-slate-900">Form Memory</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Memory</h1>
          <p className="text-slate-500 mt-1 text-sm">
            FormPilot learns from your completed forms. These are the values it remembers for future autofill suggestions.
          </p>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <p className="font-medium text-slate-900">No memory yet</p>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Complete a form to start building your memory. FormPilot will remember your answers for next time.
            </p>
            <Link href="/dashboard/upload" className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:underline font-medium">
              Upload a form →
            </Link>
          </div>
        ) : (
          <FormMemoryClient
            records={records}
            grouped={grouped}
            fieldTypeLabels={FIELD_TYPE_LABELS}
          />
        )}
      </main>
    </>
  );
}
