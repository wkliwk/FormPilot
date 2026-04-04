import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autofillFields, FormField } from "@/lib/ai/analyze-form";
import { getSuggestionsFromHistory } from "@/lib/ai/suggestion-engine";

export const maxDuration = 60;
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";

export async function POST(
  req: NextRequest,
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
  const body = await req.json().catch(() => ({})) as { expectedVersion?: number };
  const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : null;

  const form = await prisma.form.findUnique({ where: { id } });
  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Optimistic lock check — if client sent a version, enforce it
  if (expectedVersion !== null && form.version !== expectedVersion) {
    return NextResponse.json(
      { error: "conflict", currentVersion: form.version },
      { status: 409 }
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "No profile found. Set up your profile first." }, { status: 400 });
  }

  const start = Date.now();
  const fields = form.fields as unknown as FormField[];
  const profileData = profile.data as Record<string, string>;

  // Fetch historical suggestions to augment autofill (non-blocking — degrade gracefully)
  let historicalSuggestions: Awaited<ReturnType<typeof getSuggestionsFromHistory>> = [];
  try {
    historicalSuggestions = await getSuggestionsFromHistory(session.user.id, fields);
  } catch (err) {
    log.warn("Failed to fetch historical suggestions, continuing without", {
      route: "POST /api/forms/[id]/autofill",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const filledFields = await autofillFields(fields, profileData, historicalSuggestions);

    await prisma.form.update({
      where: { id },
      data: {
        fields: filledFields as object,
        filledData: filledFields.reduce((acc, f) => {
          if (f.value) acc[f.id] = f.value;
          return acc;
        }, {} as Record<string, string>),
        status: "FILLING",
        version: { increment: 1 },
      },
    });

    log.info("Form autofilled", {
      route: "POST /api/forms/[id]/autofill",
      durationMs: Date.now() - start,
      userId: session.user.id,
      filledCount: filledFields.filter((f) => f.value).length,
      totalFields: filledFields.length,
    });

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

    const profileGaps = filledFields
      .filter((f) => !f.value && f.profileKey)
      .map((f) => ({
        formField: f.label,
        profileKey: f.profileKey!,
        profileLabel: PROFILE_KEY_LABELS[f.profileKey!] ?? f.profileKey!,
      }));

    // Skipped fields: required fields that autofill could not fill
    // Reason: missing_profile_data if the profile key was absent, low_confidence otherwise
    const skippedFields = filledFields
      .filter((f) => !f.value && f.required)
      .map((f) => ({
        id: f.id,
        label: f.label,
        reason: f.profileKey && !profileData[f.profileKey] ? "missing_profile_data" : "low_confidence",
      }));

    return NextResponse.json({ fields: filledFields, profileGaps, skipped_fields: skippedFields });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/autofill");
  }
}
