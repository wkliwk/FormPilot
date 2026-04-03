import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isProUser, getOrCreateUsage, FREE_FORM_LIMIT } from "@/lib/subscription";
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
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!form || form.userId !== session.user.id!) {
    notFound();
  }

  const [profile, isPro, usage] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id! },
      select: { id: true, preferredLanguage: true, country: true, data: true },
    }),
    isProUser(session.user.id!),
    getOrCreateUsage(session.user.id!),
  ]);

  const isAtFreeLimit = !isPro && (usage.formsThisMonth >= FREE_FORM_LIMIT + usage.bonusForms);

  // Compute profile completeness (16 target fields)
  const PROFILE_FIELDS = [
    "firstName", "lastName", "email", "phone", "dateOfBirth",
    "address.street", "address.city", "address.state", "address.zip", "address.country",
    "employerName", "jobTitle", "annualIncome", "ssn", "passportNumber", "driverLicense",
  ];
  let profileCompleteness = 0;
  if (profile?.data && typeof profile.data === "object") {
    const pd = profile.data as Record<string, unknown>;
    const addr = (pd.address ?? {}) as Record<string, unknown>;
    const filled = PROFILE_FIELDS.filter((key) => {
      if (key.startsWith("address.")) {
        const sub = key.split(".")[1];
        return addr[sub] && String(addr[sub]).trim();
      }
      return pd[key] && String(pd[key]).trim();
    });
    profileCompleteness = Math.round((filled.length / PROFILE_FIELDS.length) * 100);
  }

  // Compute autofill match rate
  const formFields = form.fields as Array<{ value?: string }>;
  const totalFields = formFields.length;
  const autofilledFields = formFields.filter((f) => f.value && String(f.value).trim()).length;
  const autofillMatchRate = totalFields > 0 ? Math.round((autofilledFields / totalFields) * 100) : 100;

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
          isAtFreeLimit={isAtFreeLimit}
          profileCompleteness={profileCompleteness}
          autofillMatchRate={autofillMatchRate}
          priorForm={priorForm ? { id: priorForm.id, title: priorForm.title, createdAt: priorForm.createdAt.toISOString() } : null}
        />
      </main>
    </div>
  );
}
