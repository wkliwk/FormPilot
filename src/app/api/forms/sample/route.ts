import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

// Static fixture — a simplified W-4 Employee's Withholding Certificate.
// Fields have pre-written explanations so the user lands on the fill view
// immediately without any AI processing delay.
const SAMPLE_FIELDS: FormField[] = [
  {
    id: "s1",
    label: "First Name and Middle Initial",
    type: "text",
    required: true,
    explanation: "Enter your legal first name as it appears on your Social Security card, followed by your middle initial if applicable.",
    example: "Alex M",
    commonMistakes: "Using a nickname instead of your legal first name.",
    profileKey: "firstName",
  },
  {
    id: "s2",
    label: "Last Name",
    type: "text",
    required: true,
    explanation: "Enter your legal last name exactly as it appears on your Social Security card.",
    example: "Johnson",
    commonMistakes: "Using a married name that hasn't been updated with the SSA yet.",
    profileKey: "lastName",
  },
  {
    id: "s3",
    label: "Social Security Number",
    type: "text",
    required: true,
    explanation: "Your 9-digit Social Security Number assigned by the Social Security Administration. Use the format XXX-XX-XXXX.",
    example: "123-45-6789",
    commonMistakes: "Transposing digits or leaving out dashes.",
    profileKey: "ssn",
  },
  {
    id: "s4",
    label: "Home Address (Number and Street)",
    type: "text",
    required: true,
    explanation: "Your current primary residence street address including house or apartment number.",
    example: "456 Oak Avenue, Apt 2B",
    commonMistakes: "Using a P.O. Box instead of a street address.",
    profileKey: "address.street",
  },
  {
    id: "s5",
    label: "City or Town",
    type: "text",
    required: true,
    explanation: "The city or town where you currently reside.",
    example: "Springfield",
    commonMistakes: "Including the state name here — that goes in the next field.",
    profileKey: "address.city",
  },
  {
    id: "s6",
    label: "State",
    type: "text",
    required: true,
    explanation: "The two-letter state abbreviation for your current state of residence.",
    example: "IL",
    commonMistakes: "Writing the full state name instead of the two-letter abbreviation.",
    profileKey: "address.state",
  },
  {
    id: "s7",
    label: "ZIP Code",
    type: "text",
    required: true,
    explanation: "Your 5-digit or 9-digit ZIP code (ZIP+4 format) for your home address.",
    example: "62701",
    commonMistakes: "Using your employer's ZIP code instead of your home ZIP.",
    profileKey: "address.zip",
  },
  {
    id: "s8",
    label: "Filing Status",
    type: "select",
    required: true,
    explanation: "Your federal tax filing status. Choose 'Single or Married filing separately', 'Married filing jointly', or 'Head of household'. This affects how much tax is withheld each pay period.",
    example: "Single or Married filing separately",
    commonMistakes: "Selecting 'Married filing jointly' when you file separately, which results in too little withholding.",
  },
];

// POST /api/forms/sample — creates a demo W-4 form from static fixture.
// Does NOT increment the user's monthly quota — this is a free demo.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await prisma.form.create({
      data: {
        userId: session.user.id,
        title: "Sample — W-4 Demo",
        sourceType: "PDF",
        fields: SAMPLE_FIELDS as unknown as Parameters<typeof prisma.form.create>[0]["data"]["fields"],
        category: "TAX",
        status: "ANALYZED",
        // fileBytes intentionally omitted — no real PDF backing this demo form
      },
    });

    // Quota is intentionally NOT incremented — sample form is a free demo experience.

    return NextResponse.json({ formId: form.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/sample");
  }
}
