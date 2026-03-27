import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autofillFields, FormField } from "@/lib/ai/analyze-form";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  const { id } = await params;

  const form = await prisma.form.findUnique({ where: { id } });
  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "No profile found. Set up your profile first." }, { status: 400 });
  }

  const fields = form.fields as unknown as FormField[];
  const profileData = profile.data as Record<string, string>;
  const filledFields = await autofillFields(fields, profileData);

  await prisma.form.update({
    where: { id },
    data: {
      fields: filledFields as object,
      filledData: filledFields.reduce((acc, f) => {
        if (f.value) acc[f.id] = f.value;
        return acc;
      }, {} as Record<string, string>),
      status: "FILLING",
    },
  });

  return NextResponse.json({ fields: filledFields });
}
