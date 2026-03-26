import pdfParse from "pdf-parse";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  }

  // Word docs (.docx) — basic text extraction via reading XML
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    // For now return placeholder — will add mammoth.js in a follow-up
    throw new Error("Word document parsing coming soon. Please upload a PDF for now.");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
