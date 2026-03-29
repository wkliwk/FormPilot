import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FormPageClient from "@/components/forms/FormPageClient";

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
      <main className="mx-auto px-4 sm:px-6 py-8 sm:py-10" style={{ maxWidth: "90rem" }}>
        <FormPageClient
          form={form}
          hasProfile={!!profile}
          preferredLanguage={profile?.preferredLanguage ?? null}
          hasFile={!!form.fileBytes}
          sourceType={form.sourceType}
        />
      </main>
    </div>
  );
}
