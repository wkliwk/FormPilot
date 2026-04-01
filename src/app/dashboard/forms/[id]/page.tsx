import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
      fileBytes: true,
      fields: true,
      filledData: true,
      status: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!form || form.userId !== session.user.id!) {
    notFound();
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id! },
    select: { id: true, preferredLanguage: true },
  });

  // Strip non-serializable fields (fileBytes is a Buffer) before passing to Client Component
  const { fileBytes, userId: _uid, ...serializableForm } = form;

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-10" style={{ maxWidth: "90rem" }}>
        <FormPageClient
          form={serializableForm}
          hasProfile={!!profile}
          preferredLanguage={profile?.preferredLanguage ?? null}
          hasFile={!!fileBytes}
          sourceType={form.sourceType}
        />
      </main>
    </div>
  );
}
