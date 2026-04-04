import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

const PROFILE_KEY_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  dateOfBirth: "Date of birth",
  "address.street": "Street address",
  "address.city": "City",
  "address.state": "State",
  "address.zip": "ZIP code",
  "address.country": "Country",
  ssn: "Social Security number",
  passportNumber: "Passport number",
  employerName: "Employer name",
  jobTitle: "Job title",
  annualIncome: "Annual income",
};

// Profile keys that could plausibly be substituted for each other (semantic groups)
const ALTERNATIVES_MAP: Record<string, string[]> = {
  firstName: ["lastName", "email"],
  lastName: ["firstName", "email"],
  email: ["phone", "firstName", "lastName"],
  phone: ["email"],
  dateOfBirth: [],
  "address.street": ["address.city", "address.state", "address.zip", "address.country"],
  "address.city": ["address.street", "address.state", "address.zip"],
  "address.state": ["address.city", "address.zip", "address.country"],
  "address.zip": ["address.state", "address.city"],
  "address.country": ["address.state", "address.city"],
  ssn: ["passportNumber"],
  passportNumber: ["ssn"],
  employerName: ["jobTitle"],
  jobTitle: ["employerName"],
  annualIncome: [],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [form, profile] = await Promise.all([
      prisma.form.findUnique({ where: { id }, select: { userId: true, fields: true } }),
      prisma.profile.findUnique({ where: { userId: session.user.id }, select: { data: true } }),
    ]);

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const profileData = (profile?.data as Record<string, string>) ?? {};
    const fields = form.fields as unknown as FormField[];

    const mapping = fields
      .filter((f) => f.value && f.profileKey)
      .map((f) => {
        const altKeys = (ALTERNATIVES_MAP[f.profileKey!] ?? []).filter(
          (k) => profileData[k] !== undefined
        ).slice(0, 3);

        const suggestedAlternatives = altKeys.map((k) => ({
          profileKey: k,
          profileLabel: PROFILE_KEY_LABELS[k] ?? k,
          value: profileData[k] ?? "",
        }));

        return {
          fieldId: f.id,
          fieldLabel: f.label,
          value: f.value,
          profileKey: f.profileKey,
          profileLabel: PROFILE_KEY_LABELS[f.profileKey!] ?? f.profileKey,
          confidence: f.confidence ?? 1,
          suggestedAlternatives,
        };
      });

    return NextResponse.json({ mapping });
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]/autofill/mapping");
  }
}
