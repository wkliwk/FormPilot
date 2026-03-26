import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormField } from "@/lib/ai/analyze-form";

/**
 * Attempt to fill a PDF's AcroForm fields. Falls back to overlay text
 * if the PDF has no interactive fields.
 */
export async function fillPDF(
  originalBuffer: Buffer,
  fields: FormField[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalBuffer);
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();

  let filled = 0;

  // Try AcroForm field matching first
  for (const pdfField of pdfFields) {
    const name = pdfField.getName().toLowerCase();
    const match = fields.find(
      (f) =>
        f.value &&
        (f.id.toLowerCase() === name ||
          f.label.toLowerCase().replace(/\s+/g, "_") === name ||
          name.includes(f.id.toLowerCase()))
    );

    if (match?.value) {
      try {
        const textField = form.getTextField(pdfField.getName());
        textField.setText(match.value);
        filled++;
      } catch {
        // Field might not be a text field — skip
      }
    }
  }

  // If no AcroForm fields matched, overlay filled values as a new page summary
  if (filled === 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const summaryPage = pdfDoc.addPage();
    const { width, height } = summaryPage.getSize();
    const margin = 50;
    let y = height - margin;

    summaryPage.drawText("FormPilot — Filled Values Summary", {
      x: margin,
      y,
      size: 14,
      font,
      color: rgb(0.1, 0.3, 0.8),
    });
    y -= 30;

    for (const field of fields) {
      if (!field.value) continue;
      if (y < margin + 20) break;

      summaryPage.drawText(`${field.label}: ${field.value}`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: width - margin * 2,
      });
      y -= 18;
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
