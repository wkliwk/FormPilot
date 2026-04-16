import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { encryptSensitiveFields, decryptSensitiveFields } from "@/lib/crypto";
import { handleApiError } from "@/lib/api-error";

const SUPPORTED_LANGUAGES = ["en", "es", "zh", "ko", "vi", "tl", "ar", "hi", "fr", "pt"] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

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
  // Language preference — stored outside encrypted data blob
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES).nullable().optional(),
});

// Re-export for use in other modules
export type { SupportedLanguage };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ data: null, preferredLanguage: null });
  }

  // Decrypt sensitive fields before sending to client
  const decryptedData = decryptSensitiveFields(profile.data as Record<string, unknown>);
  return NextResponse.json({ data: decryptedData, preferredLanguage: profile.preferredLanguage ?? null });
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

  // Separate preferredLanguage from the profile data blob before encryption
  const { preferredLanguage, ...profileFields } = parsed.data;

  // Encrypt sensitive fields before storage
  const encryptedData = encryptSensitiveFields(profileFields as Record<string, unknown>);

  try {
    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        data: encryptedData as object,
        preferredLanguage: preferredLanguage ?? null,
      },
      update: {
        data: encryptedData as object,
        preferredLanguage: preferredLanguage ?? null,
      },
    });

    return NextResponse.json({ success: true, updatedAt: profile.updatedAt });
  } catch (err) {
    return handleApiError(err, "POST /api/profile");
  }
}

// PATCH: update a single top-level profile key without wiping other fields
// Used by ProfileGapSlideOver — merges one key into existing profile data
const patchBodySchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(0).max(500),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { key, value } = parsed.data;

  // Allow top-level keys or nested address keys (e.g. "address.city")
  const allowedTopKeys = new Set(Object.keys(profileSchema.shape));
  const allowedAddressKeys = new Set(["address.street", "address.city", "address.state", "address.zip", "address.country"]);
  if (!allowedTopKeys.has(key) && !allowedAddressKeys.has(key)) {
    return NextResponse.json({ error: "Unknown profile key" }, { status: 400 });
  }

  try {
    const existing = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    const currentData = existing ? decryptSensitiveFields(existing.data as Record<string, unknown>) : {};

    // Merge the single key — handle dot-notation for nested address fields
    let merged: Record<string, unknown>;
    if (key.startsWith("address.")) {
      const addressField = key.slice("address.".length);
      const existingAddress = (currentData.address as Record<string, string>) ?? {};
      merged = { ...currentData, address: { ...existingAddress, [addressField]: value } };
    } else {
      merged = { ...currentData, [key]: value };
    }
    const encryptedData = encryptSensitiveFields(merged as Record<string, unknown>);

    await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, data: encryptedData as object },
      update: { data: encryptedData as object },
    });

    // Count other forms that have a field mapped to this profileKey but are currently empty
    const userForms = await prisma.form.findMany({
      where: { userId: session.user.id },
      select: { id: true, fields: true },
    });

    let impactCount = 0;
    for (const form of userForms) {
      const formFields = form.fields as Array<{ profileKey?: string; value?: string }>;
      if (Array.isArray(formFields)) {
        const hasGap = formFields.some((f) => f.profileKey === key && !f.value);
        if (hasGap) impactCount++;
      }
    }

    return NextResponse.json({ success: true, impactCount });
  } catch (err) {
    return handleApiError(err, "PATCH /api/profile");
  }
}
