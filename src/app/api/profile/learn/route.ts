import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { normalizeLabel } from "@/lib/ai/suggestion-engine";
import { encryptSensitiveFields, decryptSensitiveFields } from "@/lib/crypto";
import { handleApiError } from "@/lib/api-error";

// POST /api/profile/learn — save a user correction to form memory AND profile
// Called when user edits an autofilled field and chooses "Save this correction"
//
// - Always writes to FormMemory (fieldType: "correction", confidence: 1.0)
// - If profileKey is provided and maps to a known profile field, also patches the profile

const ALLOWED_ADDRESS_SUBKEYS = new Set(["street", "city", "state", "zip", "country"]);

const bodySchema = z.object({
  fieldLabel: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  profileKey: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { fieldLabel, value, profileKey } = parsed.data;
  const normalizedLabel = normalizeLabel(fieldLabel);

  if (!normalizedLabel) {
    return NextResponse.json({ error: "Invalid field label" }, { status: 400 });
  }

  try {
    // 1. Always save to FormMemory
    await prisma.formMemory.upsert({
      where: { userId_label: { userId: session.user.id, label: normalizedLabel } },
      create: {
        userId: session.user.id,
        fieldType: "correction",
        label: normalizedLabel,
        value,
        confidence: 1.0,
        sourceFormId: "manual",
        sourceTitle: "User correction",
        lastUsed: new Date(),
      },
      update: {
        value,
        fieldType: "correction",
        confidence: 1.0,
        lastUsed: new Date(),
      },
    });

    // 2. Also patch the profile if a valid profileKey was provided
    let profileUpdated = false;
    if (profileKey) {
      const allowedTopKeys = new Set([
        "firstName", "lastName", "email", "phone", "dateOfBirth",
        "employerName", "jobTitle", "annualIncome", "ssn", "passportNumber", "driverLicense", "taxId",
      ]);
      const isAddressKey = profileKey.startsWith("address.") &&
        ALLOWED_ADDRESS_SUBKEYS.has(profileKey.slice("address.".length));

      if (allowedTopKeys.has(profileKey) || isAddressKey) {
        const existing = await prisma.profile.findUnique({ where: { userId: session.user.id } });
        const currentData = existing ? decryptSensitiveFields(existing.data as Record<string, unknown>) : {};

        let merged: Record<string, unknown>;
        if (isAddressKey) {
          const addressField = profileKey.slice("address.".length);
          const existingAddress = (currentData.address as Record<string, string>) ?? {};
          merged = { ...currentData, address: { ...existingAddress, [addressField]: value } };
        } else {
          merged = { ...currentData, [profileKey]: value };
        }

        const encryptedData = encryptSensitiveFields(merged as Record<string, unknown>);
        await prisma.profile.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, data: encryptedData as object },
          update: { data: encryptedData as object },
        });
        profileUpdated = true;
      }
    }

    return NextResponse.json({ success: true, profileUpdated });
  } catch (err) {
    return handleApiError(err, "POST /api/profile/learn");
  }
}
