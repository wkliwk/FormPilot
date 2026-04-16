import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract existing AcroForm field values from a PDF.
 * Returns a map of normalised field name → value for any fields that have a non-empty value.
 * If the PDF has no AcroForm structure, returns an empty map (never throws).
 */
export async function extractAcroFormValues(buffer: Buffer): Promise<Record<string, string>> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const pdfFields = form.getFields();
    const result: Record<string, string> = {};
    for (const field of pdfFields) {
      const name = field.getName();
      let value: string | undefined;
      if (field instanceof PDFTextField) {
        const text = field.getText();
        if (text && text.trim()) value = text.trim();
      } else if (field instanceof PDFCheckBox) {
        if (field.isChecked()) value = "Checked";
      } else if (field instanceof PDFDropdown) {
        const selected = field.getSelected();
        if (selected.length > 0 && selected[0].trim()) value = selected[0].trim();
      } else if (field instanceof PDFRadioGroup) {
        const selected = field.getSelected();
        if (selected && selected.trim()) value = selected.trim();
      }
      if (value) result[name] = value;
    }
    return result;
  } catch {
    // PDF has no AcroForm, is encrypted, or parsing failed — silently return empty
    return {};
  }
}

export async function getPDFPageCount(buffer: Buffer): Promise<number> {
  const data = await pdfParse(buffer);
  return data.numpages;
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
