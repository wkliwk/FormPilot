/**
 * Unit tests for extractAcroFormValues
 * Tests that AcroForm field values are correctly read from a PDF.
 */

import { PDFDocument, PDFTextField } from "pdf-lib";
import { extractAcroFormValues } from "@/lib/pdf/extract";

/** Build a minimal PDF buffer with AcroForm text fields. */
async function buildPDFWithFields(
  fields: Array<{ name: string; value: string }>
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage();
  const form = pdfDoc.getForm();
  for (const { name, value } of fields) {
    const field = form.createTextField(name);
    field.setText(value);
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/** Build a minimal flat PDF with no AcroForm. */
async function buildFlatPDF(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage();
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe("extractAcroFormValues", () => {
  it("extracts text field values from a PDF with AcroForm fields", async () => {
    const buf = await buildPDFWithFields([
      { name: "FirstName", value: "Alice" },
      { name: "LastName", value: "Wong" },
      { name: "Email", value: "alice@example.com" },
    ]);

    const values = await extractAcroFormValues(buf);

    expect(values["FirstName"]).toBe("Alice");
    expect(values["LastName"]).toBe("Wong");
    expect(values["Email"]).toBe("alice@example.com");
  });

  it("returns empty object for a flat PDF with no AcroForm", async () => {
    const buf = await buildFlatPDF();
    const values = await extractAcroFormValues(buf);
    expect(values).toEqual({});
  });

  it("omits fields with empty values", async () => {
    const buf = await buildPDFWithFields([
      { name: "FilledField", value: "Hello" },
      { name: "EmptyField", value: "" },
    ]);

    const values = await extractAcroFormValues(buf);

    expect(values["FilledField"]).toBe("Hello");
    expect("EmptyField" in values).toBe(false);
  });

  it("returns empty object for an invalid buffer without throwing", async () => {
    const garbage = Buffer.from("this is not a pdf");
    const values = await extractAcroFormValues(garbage);
    expect(values).toEqual({});
  });

  it("trims whitespace from extracted values", async () => {
    const buf = await buildPDFWithFields([
      { name: "City", value: "  New York  " },
    ]);

    const values = await extractAcroFormValues(buf);
    expect(values["City"]).toBe("New York");
  });
});
