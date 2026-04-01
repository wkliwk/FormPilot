import {
  PDFDocument,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { FormField } from "@/lib/ai/analyze-form";
import { normalize } from "./annotation-helpers";

/**
 * Resolve which FormField (if any) corresponds to a PDF AcroForm field.
 *
 * Matching priority:
 *  1. Exact normalized match between PDF field name and FormField label
 *  2. Substring match (either direction)
 *  3. Exact normalized match between PDF field name and FormField id
 *
 * Returns null when no match is found.
 */
function resolveField(pdfName: string, fields: FormField[]): FormField | null {
  const normName = normalize(pdfName);
  if (!normName) return null;

  // 1. Exact label match
  const exactLabel = fields.find(
    (f) => f.value && normalize(f.label) === normName
  );
  if (exactLabel) return exactLabel;

  // 2. Substring label match (either direction)
  const subLabel = fields.find(
    (f) =>
      f.value &&
      (normalize(f.label).includes(normName) ||
        normName.includes(normalize(f.label)))
  );
  if (subLabel) return subLabel;

  // 3. Exact id match (AI snake_case ids occasionally align with PDF names)
  const exactId = fields.find(
    (f) => f.value && normalize(f.id) === normName
  );
  if (exactId) return exactId;

  return null;
}

/**
 * Write a value into a PDF AcroForm field, handling text, checkbox, radio,
 * and dropdown field types. Returns true if the field was written.
 */
function writeField(pdfField: PDFField, value: string): boolean {
  if (pdfField instanceof PDFTextField) {
    pdfField.setText(value);
    return true;
  }

  if (pdfField instanceof PDFCheckBox) {
    const truthy = /^(true|yes|1|x|on|checked)$/i.test(value.trim());
    if (truthy) {
      pdfField.check();
    } else {
      pdfField.uncheck();
    }
    return true;
  }

  if (pdfField instanceof PDFRadioGroup) {
    try {
      // Try selecting by the exact option value first, then case-insensitive
      const options = pdfField.getOptions();
      const match = options.find(
        (opt) => opt.toLowerCase() === value.trim().toLowerCase()
      );
      if (match) {
        pdfField.select(match);
        return true;
      }
    } catch {
      // Radio group has no matching option — skip silently
    }
    return false;
  }

  if (pdfField instanceof PDFDropdown) {
    try {
      const options = pdfField.getOptions();
      const match = options.find(
        (opt) => opt.toLowerCase() === value.trim().toLowerCase()
      );
      if (match) {
        pdfField.select(match);
        return true;
      }
    } catch {
      // Dropdown has no matching option — skip silently
    }
    return false;
  }

  return false;
}

/**
 * Attempt to fill a PDF's AcroForm fields. Falls back to overlay text
 * if the PDF has no interactive fields or none matched.
 */
export async function fillPDF(
  originalBuffer: Buffer,
  fields: FormField[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalBuffer);
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();

  let filled = 0;
  const unmatched: string[] = [];

  for (const pdfField of pdfFields) {
    const pdfName = pdfField.getName();
    const match = resolveField(pdfName, fields);

    if (match?.value) {
      const wrote = writeField(pdfField, match.value);
      if (wrote) {
        filled++;
        console.log(`[fillPDF] matched "${pdfName}" → "${match.label}" = "${match.value}"`);
      } else {
        unmatched.push(`${pdfName} (type mismatch for value "${match.value}")`);
      }
    } else {
      unmatched.push(pdfName);
    }
  }

  if (unmatched.length > 0) {
    console.log(`[fillPDF] ${unmatched.length} unmatched PDF fields:`, unmatched.slice(0, 20));
  }
  console.log(`[fillPDF] filled ${filled} of ${pdfFields.length} AcroForm fields`);

  // If no AcroForm fields matched, overlay filled values as a summary page
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
