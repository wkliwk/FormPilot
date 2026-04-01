/**
 * Tests for the PDF fill logic.
 *
 * We create in-memory PDFs using pdf-lib directly so tests run without fixtures.
 */

import { PDFDocument } from "pdf-lib";
import { fillPDF } from "../lib/pdf/fill";
import type { FormField } from "../lib/ai/analyze-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<FormField> & { id: string; label: string }): FormField {
  return {
    type: "text",
    required: false,
    explanation: "",
    example: "",
    commonMistakes: "",
    ...overrides,
  };
}

/**
 * Build an in-memory PDF containing the given AcroForm text field names.
 * Returns a Buffer of the raw PDF bytes.
 */
async function buildPDFWithTextFields(fieldNames: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  for (let i = 0; i < fieldNames.length; i++) {
    const field = form.createTextField(fieldNames[i]);
    field.addToPage(page, { x: 50, y: 750 - i * 30, width: 200, height: 20 });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Build an in-memory PDF containing a checkbox AcroForm field.
 */
async function buildPDFWithCheckbox(fieldName: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  const cb = form.createCheckBox(fieldName);
  cb.addToPage(page, { x: 50, y: 750, width: 20, height: 20 });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Build an in-memory PDF containing a dropdown AcroForm field.
 */
async function buildPDFWithDropdown(fieldName: string, options: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  const dropdown = form.createDropdown(fieldName);
  dropdown.setOptions(options);
  dropdown.addToPage(page, { x: 50, y: 750, width: 200, height: 20 });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Read the text field values from a filled PDF buffer.
 */
async function readTextFields(buffer: Buffer): Promise<Record<string, string>> {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();
  const result: Record<string, string> = {};
  for (const field of form.getFields()) {
    try {
      // Dynamically import to get the class reference for instanceof checks
      const { PDFTextField } = await import("pdf-lib");
      if (field instanceof PDFTextField) {
        result[field.getName()] = field.getText() ?? "";
      }
    } catch {
      // ignore non-text fields
    }
  }
  return result;
}

/**
 * Read the checked state of a checkbox from a filled PDF buffer.
 */
async function readCheckbox(buffer: Buffer, fieldName: string): Promise<boolean> {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();
  try {
    const cb = form.getCheckBox(fieldName);
    return cb.isChecked();
  } catch {
    return false;
  }
}

/**
 * Read the selected option of a dropdown from a filled PDF buffer.
 */
async function readDropdown(buffer: Buffer, fieldName: string): Promise<string> {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();
  try {
    const dd = form.getDropdown(fieldName);
    return dd.getSelected()[0] ?? "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fillPDF — text field mapping", () => {
  it("fills a text field with exact label match (case-insensitive)", async () => {
    // PDF has a field literally named "First Name"
    const buf = await buildPDFWithTextFields(["First Name"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Alice" }),
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    expect(values["First Name"]).toBe("Alice");
  });

  it("fills a text field via substring label match (PDF name contained in field label)", async () => {
    // PDF field name is "Name" — our label is "First Name" which contains "name"
    const buf = await buildPDFWithTextFields(["name"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Bob" }),
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    // "name" is a substring of normalize("First Name") = "first name"
    expect(values["name"]).toBe("Bob");
  });

  it("fills multiple text fields independently", async () => {
    const buf = await buildPDFWithTextFields(["First Name", "Last Name", "Email Address"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Carol" }),
      makeField({ id: "last_name", label: "Last Name", value: "Smith" }),
      makeField({ id: "email", label: "Email Address", value: "carol@example.com" }),
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    expect(values["First Name"]).toBe("Carol");
    expect(values["Last Name"]).toBe("Smith");
    expect(values["Email Address"]).toBe("carol@example.com");
  });

  it("does not fill a text field that has no matching FormField", async () => {
    const buf = await buildPDFWithTextFields(["Employer EIN"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Dave" }),
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    // "Employer EIN" should not be filled — no matching form field
    expect(values["Employer EIN"]).toBe("");
  });

  it("skips FormFields with no value", async () => {
    const buf = await buildPDFWithTextFields(["First Name"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name" }), // no value
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    expect(values["First Name"]).toBe("");
  });

  it("falls back to id match when no label match found", async () => {
    // PDF field name matches the field id exactly (after normalization)
    const buf = await buildPDFWithTextFields(["address_zip"]);
    const fields: FormField[] = [
      makeField({ id: "address_zip", label: "ZIP Code", value: "90210" }),
    ];

    const filled = await fillPDF(buf, fields);
    const values = await readTextFields(filled);

    // "address_zip" normalized = "addresszip", id normalized = "addresszip" → match via id
    expect(values["address_zip"]).toBe("90210");
  });
});

describe("fillPDF — checkbox field mapping", () => {
  it("checks a checkbox for truthy values", async () => {
    for (const truthy of ["yes", "true", "1", "x", "on", "checked"]) {
      const buf = await buildPDFWithCheckbox("Single");
      const fields: FormField[] = [
        makeField({ id: "single", label: "Single", value: truthy }),
      ];

      const filled = await fillPDF(buf, fields);
      expect(await readCheckbox(filled, "Single")).toBe(true);
    }
  });

  it("unchecks a checkbox for falsy values", async () => {
    const buf = await buildPDFWithCheckbox("Single");
    const fields: FormField[] = [
      makeField({ id: "single", label: "Single", value: "no" }),
    ];

    const filled = await fillPDF(buf, fields);
    expect(await readCheckbox(filled, "Single")).toBe(false);
  });
});

describe("fillPDF — dropdown field mapping", () => {
  it("selects a dropdown option (case-insensitive)", async () => {
    const buf = await buildPDFWithDropdown("Filing Status", ["Single", "Married", "Head of Household"]);
    const fields: FormField[] = [
      makeField({ id: "filing_status", label: "Filing Status", value: "married" }),
    ];

    const filled = await fillPDF(buf, fields);
    expect(await readDropdown(filled, "Filing Status")).toBe("Married");
  });

  it("skips dropdown when value does not match any option", async () => {
    const buf = await buildPDFWithDropdown("Filing Status", ["Single", "Married"]);
    const fields: FormField[] = [
      makeField({ id: "filing_status", label: "Filing Status", value: "Unknown Option" }),
    ];

    // Should not throw — just skips the field
    await expect(fillPDF(buf, fields)).resolves.toBeInstanceOf(Buffer);
  });
});

describe("fillPDF — fallback summary page", () => {
  it("appends a summary page when the PDF has no AcroForm fields", async () => {
    // Create a plain PDF with no form fields
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const bytes = await doc.save();
    const buf = Buffer.from(bytes);

    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Eve" }),
    ];

    const filled = await fillPDF(buf, fields);
    const resultDoc = await PDFDocument.load(filled);

    // Original had 1 page; summary appended = 2 pages
    expect(resultDoc.getPageCount()).toBe(2);
  });

  it("appends a summary page when no PDF fields matched any FormField", async () => {
    // PDF has a field that won't match anything
    const buf = await buildPDFWithTextFields(["zzz_totally_unmatchable_xqq"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Frank" }),
    ];

    const filled = await fillPDF(buf, fields);
    const resultDoc = await PDFDocument.load(filled);

    // 1 original page + 1 summary page
    expect(resultDoc.getPageCount()).toBe(2);
  });

  it("does NOT append a summary page when at least one field was written", async () => {
    const buf = await buildPDFWithTextFields(["First Name"]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name", value: "Grace" }),
    ];

    const filled = await fillPDF(buf, fields);
    const resultDoc = await PDFDocument.load(filled);

    expect(resultDoc.getPageCount()).toBe(1);
  });
});

describe("fillPDF — real-world W-4 style field names", () => {
  it("matches common W-4 internal field naming patterns", async () => {
    // W-4 PDFs use internal names like "topmostSubform[0].Page1[0].f1_1[0]"
    // These won't match any label — should fall through gracefully without error
    const buf = await buildPDFWithTextFields([
      "topmostSubform[0].Page1[0].f1_1[0]",
      "topmostSubform[0].Page1[0].f1_2[0]",
    ]);
    const fields: FormField[] = [
      makeField({ id: "first_name", label: "First Name and Middle Initial", value: "John A" }),
      makeField({ id: "last_name", label: "Last Name", value: "Doe" }),
    ];

    // Should not throw — gracefully fall back to summary page
    const filled = await fillPDF(buf, fields);
    expect(filled).toBeInstanceOf(Buffer);
    expect(filled.length).toBeGreaterThan(0);

    const resultDoc = await PDFDocument.load(filled);
    // Summary page appended since no AcroForm fields matched
    expect(resultDoc.getPageCount()).toBe(2);
  });
});
