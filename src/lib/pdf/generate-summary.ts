import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { FormField } from "@/lib/ai/analyze-form";

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN = 50;
const LINE_HEIGHT = 18;
const SECTION_GAP = 10;

/**
 * Generates a text-summary PDF for image-based forms where overlay export
 * is not possible. Lists all filled fields as labelled rows.
 */
export async function generateSummaryPDF(
  formTitle: string,
  fields: FormField[],
  exportedAt: Date
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const blue = rgb(0.145, 0.388, 0.922);
  const dark = rgb(0.118, 0.157, 0.286);
  const mid = rgb(0.392, 0.455, 0.545);
  const light = rgb(0.878, 0.902, 0.929);

  const filledFields = fields.filter((f) => f.value);

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  function maybeNewPage() {
    if (y < MARGIN + LINE_HEIGHT * 3) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }
  }

  // Header bar
  page.drawRectangle({ x: 0, y: A4_HEIGHT - 56, width: A4_WIDTH, height: 56, color: blue });
  page.drawText("FormPilot", {
    x: MARGIN,
    y: A4_HEIGHT - 36,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Filled Form Summary", {
    x: MARGIN + 120,
    y: A4_HEIGHT - 36,
    size: 11,
    font: regular,
    color: rgb(0.8, 0.87, 1),
  });

  y = A4_HEIGHT - 80;

  // Form title
  page.drawText(formTitle, {
    x: MARGIN,
    y,
    size: 14,
    font: bold,
    color: dark,
    maxWidth: A4_WIDTH - MARGIN * 2,
  });
  y -= LINE_HEIGHT + SECTION_GAP;

  // Export date
  const dateStr = exportedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  page.drawText(`Exported: ${dateStr}`, {
    x: MARGIN,
    y,
    size: 9,
    font: regular,
    color: mid,
  });
  y -= LINE_HEIGHT;

  // Divider
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4_WIDTH - MARGIN, y }, thickness: 0.5, color: light });
  y -= LINE_HEIGHT;

  // Fields
  for (const field of filledFields) {
    maybeNewPage();

    // Label
    page.drawText(field.label, {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: mid,
      maxWidth: A4_WIDTH - MARGIN * 2,
    });
    y -= LINE_HEIGHT - 4;

    maybeNewPage();

    // Value
    const valueText = String(field.value ?? "");
    page.drawText(valueText, {
      x: MARGIN,
      y,
      size: 11,
      font: regular,
      color: dark,
      maxWidth: A4_WIDTH - MARGIN * 2,
    });
    y -= LINE_HEIGHT + SECTION_GAP;

    // Light separator
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4_WIDTH - MARGIN, y }, thickness: 0.3, color: light });
    y -= SECTION_GAP;
  }

  // Footer on last page
  const lastPage = pdfDoc.getPages().at(-1)!;
  lastPage.drawText("Filled by FormPilot — attach this summary alongside your original form.", {
    x: MARGIN,
    y: MARGIN - 10,
    size: 8,
    font: regular,
    color: mid,
  });

  return pdfDoc.save();
}
