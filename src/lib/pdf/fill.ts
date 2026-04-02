import {
  PDFDocument,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { FormField } from "@/lib/ai/analyze-form";
import { normalize } from "./annotation-helpers";

/**
 * Get the tooltip / alternate name (/TU entry) from a PDF AcroForm field.
 * W-4 and similar government PDFs store the human-readable label here even
 * when the internal field name is an opaque identifier like "f1_09[0]".
 */
function getFieldAltText(pdfField: PDFField): string | undefined {
  try {
    const tu = pdfField.acroField.dict.get(PDFName.of("TU"));
    if (tu instanceof PDFString) return tu.decodeText();
  } catch {
    // ignore — not all fields have /TU
  }
  return undefined;
}

/**
 * Resolve which FormField (if any) corresponds to a PDF AcroForm field.
 *
 * Matching priority (tried against both the PDF field name and its /TU alt text):
 *  1. Exact normalized match against FormField label
 *  2. Substring match (either direction) against FormField label
 *  3. Exact normalized match against FormField id
 *
 * Returns null when no match is found.
 */
function resolveField(
  pdfName: string,
  altText: string | undefined,
  fields: FormField[]
): FormField | null {
  // Build candidate list: field name first, then alt text (tooltip)
  const candidates = [pdfName, altText].filter(Boolean) as string[];

  // 1. Exact label match
  for (const cand of candidates) {
    const norm = normalize(cand);
    if (!norm) continue;
    const exact = fields.find((f) => f.value && normalize(f.label) === norm);
    if (exact) return exact;
  }

  // 2. Substring label match (either direction)
  for (const cand of candidates) {
    const norm = normalize(cand);
    if (!norm) continue;
    const sub = fields.find(
      (f) =>
        f.value &&
        (normalize(f.label).includes(norm) || norm.includes(normalize(f.label)))
    );
    if (sub) return sub;
  }

  // 3. Exact id match (AI snake_case ids occasionally align with PDF names)
  for (const cand of candidates) {
    const norm = normalize(cand);
    if (!norm) continue;
    const exactId = fields.find((f) => f.value && normalize(f.id) === norm);
    if (exactId) return exactId;
  }

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
    const altText = getFieldAltText(pdfField);
    const match = resolveField(pdfName, altText, fields);

    if (match?.value) {
      const wrote = writeField(pdfField, match.value);
      if (wrote) {
        filled++;
        const via = altText && normalize(altText) !== normalize(pdfName) ? ` (via altText: "${altText}")` : "";
        console.log(`[fillPDF] matched "${pdfName}"${via} → "${match.label}" = "${match.value}"`);
      } else {
        unmatched.push(`${pdfName} (type mismatch for value "${match.value}")`);
      }
    } else {
      unmatched.push(altText ? `${pdfName} / "${altText}"` : pdfName);
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
