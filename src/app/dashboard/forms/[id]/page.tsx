import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import FormPageClient from "@/components/forms/FormPageClient";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const form = await prisma.form.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      title: true,
      sourceType: true,
      fileBytes: true, // needed only for hasFile check below — not passed to client
      fields: true,
      filledData: true,
      status: true,
      category: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!form || form.userId !== session.user.id!) {
    notFound();
  }

  const [profile, isPro] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id! },
      select: { id: true, preferredLanguage: true, country: true },
    }),
    isProUser(session.user.id!),
  ]);

  // Find a prior completed/in-progress form of the same category within 90 days
  // with ≥3 filled fields (to avoid suggesting near-empty forms)
  let priorForm: { id: string; title: string; createdAt: Date } | null = null;
  if (form.category) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.form.findMany({
      where: {
        userId: session.user.id!,
        id: { not: id },
        category: form.category,
        status: { in: ["COMPLETED", "FILLING"] },
        createdAt: { gte: ninetyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, filledData: true, createdAt: true },
    });

    // Only suggest forms with ≥3 filled values
    const eligible = candidates.find((c) => {
      if (!c.filledData || typeof c.filledData !== "object") return false;
      const vals = Object.values(c.filledData as Record<string, unknown>);
      return vals.filter((v) => v !== null && v !== undefined && String(v).trim()).length >= 3;
    });
    if (eligible) {
      priorForm = { id: eligible.id, title: eligible.title, createdAt: eligible.createdAt };
    }
  }

  // Strip non-serializable fields (fileBytes is a Buffer) before passing to Client Component
  const { fileBytes, userId: _uid, ...serializableForm } = form;

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-10" style={{ maxWidth: "90rem" }}>
        <FormPageClient
          form={serializableForm}
          hasProfile={!!profile}
          preferredLanguage={form.language ?? profile?.preferredLanguage ?? null}
          profileCountry={profile?.country ?? null}
          hasFile={!!fileBytes}
          sourceType={form.sourceType}
          isPro={isPro}
          priorForm={priorForm ? { id: priorForm.id, title: priorForm.title, createdAt: priorForm.createdAt.toISOString() } : null}
        />
      </main>
    </div>
  );
}
