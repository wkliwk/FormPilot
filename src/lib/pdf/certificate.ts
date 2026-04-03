import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";
import { createHash } from "crypto";
import type { FormField } from "@/lib/ai/analyze-form";

/**
 * Generates a single-page A4 PDF completion certificate.
 * Does NOT include field values — only labels and filled status.
 */
export async function generateCertificate({
  formId,
  userId,
  formTitle,
  category,
  completedAt,
  fields,
  userName,
}: {
  formId: string;
  userId: string;
  formTitle: string;
  category: string | null;
  completedAt: Date;
  fields: FormField[];
  userName?: string | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // A4 dimensions in points (1pt = 1/72 inch)
  const A4_WIDTH = 595;
  const A4_HEIGHT = 842;

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colors
  const blue = rgb(0.145, 0.388, 0.922); // #2563EB
  const darkGray = rgb(0.118, 0.157, 0.286); // #1E2849
  const midGray = rgb(0.392, 0.455, 0.545); // #647388
  const lightGray = rgb(0.886, 0.91, 0.937); // #E2E8EF
  const white = rgb(1, 1, 1);
  const green = rgb(0.133, 0.545, 0.498); // #22897F
  const amber = rgb(0.6, 0.412, 0.086); // #996916

  // -- Header band --
  page.drawRectangle({ x: 0, y: A4_HEIGHT - 80, width: A4_WIDTH, height: 80, color: blue });

  // WordMark
  page.drawText("Form", {
    x: 40,
    y: A4_HEIGHT - 52,
    size: 28,
    font: helveticaBold,
    color: white,
  });
  page.drawText("Pilot", {
    x: 40 + helveticaBold.widthOfTextAtSize("Form", 28),
    y: A4_HEIGHT - 52,
    size: 28,
    font: helvetica,
    color: rgb(0.8, 0.88, 1),
  });

  // "Completion Certificate" label top-right
  const certLabel = "COMPLETION CERTIFICATE";
  const certLabelWidth = helveticaBold.widthOfTextAtSize(certLabel, 9);
  page.drawText(certLabel, {
    x: A4_WIDTH - 40 - certLabelWidth,
    y: A4_HEIGHT - 34,
    size: 9,
    font: helveticaBold,
    color: rgb(0.8, 0.88, 1),
  });
  const certSubLabel = "Verified by FormPilot";
  const certSubLabelWidth = helvetica.widthOfTextAtSize(certSubLabel, 8);
  page.drawText(certSubLabel, {
    x: A4_WIDTH - 40 - certSubLabelWidth,
    y: A4_HEIGHT - 50,
    size: 8,
    font: helvetica,
    color: rgb(0.7, 0.8, 0.96),
  });

  // -- Body --
  const bodyTop = A4_HEIGHT - 80 - 40; // 40pt padding below header

  // Form title
  const titleLines = wrapText(formTitle, helveticaBold, 22, A4_WIDTH - 80);
  let y = bodyTop;
  for (const line of titleLines) {
    page.drawText(line, { x: 40, y, size: 22, font: helveticaBold, color: darkGray });
    y -= 28;
  }

  y -= 6;

  // Category badge
  if (category) {
    const badge = category.replace(/_/g, " ");
    const badgeWidth = helveticaBold.widthOfTextAtSize(badge, 9) + 16;
    page.drawRectangle({ x: 40, y: y - 4, width: badgeWidth, height: 20, color: rgb(0.918, 0.957, 1) });
    page.drawText(badge, { x: 40 + 8, y: y + 2, size: 9, font: helveticaBold, color: blue });
    y -= 30;
  }

  y -= 4;

  // Divider
  page.drawLine({ start: { x: 40, y }, end: { x: A4_WIDTH - 40, y }, thickness: 1, color: lightGray });
  y -= 24;

  // Completion date + fields count — two columns
  const completionDateStr = completedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const filledCount = fields.filter((f) => f.value).length;
  const totalCount = fields.length;

  page.drawText("COMPLETED ON", { x: 40, y, size: 8, font: helveticaBold, color: midGray });
  page.drawText("FIELDS FILLED", { x: 220, y, size: 8, font: helveticaBold, color: midGray });
  if (userName) {
    page.drawText("COMPLETED BY", { x: 380, y, size: 8, font: helveticaBold, color: midGray });
  }
  y -= 18;
  page.drawText(completionDateStr, { x: 40, y, size: 14, font: helveticaBold, color: darkGray });
  page.drawText(`${filledCount} / ${totalCount}`, { x: 220, y, size: 14, font: helveticaBold, color: darkGray });
  if (userName) {
    const truncatedName = truncateText(userName, helveticaBold, 14, A4_WIDTH - 380 - 40);
    page.drawText(truncatedName, { x: 380, y, size: 14, font: helveticaBold, color: darkGray });
  }

  y -= 36;

  // Divider
  page.drawLine({ start: { x: 40, y }, end: { x: A4_WIDTH - 40, y }, thickness: 1, color: lightGray });
  y -= 24;

  // Fields section header
  page.drawText("FORM FIELDS", { x: 40, y, size: 8, font: helveticaBold, color: midGray });
  y -= 18;

  // Fields list — two columns, labels only with filled indicator
  const colWidth = (A4_WIDTH - 80 - 20) / 2;
  const fieldFontSize = 8.5;
  const fieldLineHeight = 16;

  const leftFields = fields.filter((_, i) => i % 2 === 0);
  const rightFields = fields.filter((_, i) => i % 2 === 1);
  const maxRows = Math.max(leftFields.length, rightFields.length);
  const maxFieldsToShow = Math.floor((y - 80) / fieldLineHeight); // leave room for footer

  for (let i = 0; i < Math.min(maxRows, maxFieldsToShow); i++) {
    const left = leftFields[i];
    const right = rightFields[i];

    if (left) {
      drawFieldRow(page, 40, y, left, colWidth, fieldFontSize, helvetica, helveticaBold, green, amber, midGray, darkGray);
    }
    if (right) {
      drawFieldRow(page, 40 + colWidth + 20, y, right, colWidth, fieldFontSize, helvetica, helveticaBold, green, amber, midGray, darkGray);
    }
    y -= fieldLineHeight;
  }

  // "… and N more fields" if truncated
  const shown = Math.min(fields.length, maxFieldsToShow * 2);
  if (shown < fields.length) {
    y -= 4;
    page.drawText(`… and ${fields.length - shown} more fields`, {
      x: 40, y, size: 8, font: helvetica, color: midGray,
    });
  }

  // -- Footer --
  const verificationId = formId.slice(-8).toUpperCase();
  const certId = buildCertId(formId, userId, completedAt);
  const footerY = 36;

  page.drawLine({ start: { x: 40, y: footerY + 36 }, end: { x: A4_WIDTH - 40, y: footerY + 36 }, thickness: 1, color: lightGray });
  page.drawText("Filled with confidence using FormPilot", {
    x: 40, y: footerY + 22, size: 8, font: helvetica, color: midGray,
  });
  page.drawText(`Verification ID: ${verificationId}  ·  Certificate: ${certId}`, {
    x: 40, y: footerY + 8, size: 8, font: helvetica, color: midGray,
  });
  page.drawText("getformpilot.com", {
    x: A4_WIDTH - 40 - helvetica.widthOfTextAtSize("getformpilot.com", 8),
    y: footerY + 8,
    size: 8, font: helvetica, color: midGray,
  });

  return await pdfDoc.save();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function drawFieldRow(
  page: PDFPage,
  x: number,
  y: number,
  field: FormField,
  maxWidth: number,
  fontSize: number,
  regularFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  boldFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  greenColor: ReturnType<typeof rgb>,
  amberColor: ReturnType<typeof rgb>,
  midGray: ReturnType<typeof rgb>,
  darkGray: ReturnType<typeof rgb>
) {
  const filled = !!field.value;
  const dot = filled ? "●" : "○";
  const dotColor = filled ? greenColor : amberColor;

  // Dot
  page.drawText(dot, { x, y, size: fontSize - 0.5, font: regularFont, color: dotColor });

  // Label (truncated)
  const labelX = x + 12;
  const availWidth = maxWidth - 12;
  const label = truncateText(field.label, regularFont, fontSize, availWidth);
  page.drawText(label, {
    x: labelX, y, size: fontSize, font: field.required ? boldFont : regularFont,
    color: darkGray,
  });
}

function buildCertId(formId: string, userId: string, completedAt: Date): string {
  return createHash("sha256")
    .update(`${formId}${userId}${completedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncateText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + "…", size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}
