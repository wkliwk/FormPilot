import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { encryptSensitiveFields, decryptSensitiveFields } from "@/lib/crypto";

const profileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  dateOfBirth: z.string().max(20).optional(),
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      zip: z.string().max(20).optional(),
      country: z.string().max(100).optional(),
    })
    .optional(),
  employerName: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  annualIncome: z.string().max(30).optional(),
  // Sensitive fields — encrypted at rest
  ssn: z.string().max(20).optional(),
  passportNumber: z.string().max(30).optional(),
  driverLicense: z.string().max(30).optional(),
  taxId: z.string().max(30).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ data: null });
  }

  // Decrypt sensitive fields before sending to client
  const decryptedData = decryptSensitiveFields(profile.data as Record<string, unknown>);
  return NextResponse.json({ data: decryptedData });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Encrypt sensitive fields before storage
  const encryptedData = encryptSensitiveFields(parsed.data as Record<string, unknown>);

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      data: encryptedData as object,
    },
    update: {
      data: encryptedData as object,
    },
  });

  return NextResponse.json({ success: true, updatedAt: profile.updatedAt });
}
