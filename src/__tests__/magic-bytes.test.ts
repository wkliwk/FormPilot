function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  if (buffer.length < 8) return false;
  switch (claimedType) {
    case "application/pdf":
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    case "image/png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    case "image/heic":
    case "image/heif":
      return buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
    default:
      return false;
  }
}

describe("validateMagicBytes", () => {
  it("accepts valid PDF", () => {
    expect(validateMagicBytes(Buffer.from("%PDF-1.7 content", "ascii"), "application/pdf")).toBe(true);
  });
  it("rejects fake PDF", () => {
    expect(validateMagicBytes(Buffer.from("not a PDF file!!", "ascii"), "application/pdf")).toBe(false);
  });
  it("accepts valid DOCX (ZIP)", () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x50; buf[1] = 0x4b; buf[2] = 0x03; buf[3] = 0x04;
    expect(validateMagicBytes(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });
  it("rejects fake DOCX", () => {
    expect(validateMagicBytes(Buffer.from("not a zip file!!", "ascii"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
  });
  it("accepts valid PNG", () => {
    const buf = Buffer.alloc(16); buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    expect(validateMagicBytes(buf, "image/png")).toBe(true);
  });
  it("accepts valid JPEG", () => {
    const buf = Buffer.alloc(16); buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
    expect(validateMagicBytes(buf, "image/jpeg")).toBe(true);
  });
  it("accepts valid WebP", () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    expect(validateMagicBytes(buf, "image/webp")).toBe(true);
  });
  it("rejects RIFF without WEBP", () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    expect(validateMagicBytes(buf, "image/webp")).toBe(false);
  });
  it("accepts valid HEIC/HEIF", () => {
    const buf = Buffer.alloc(16);
    buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70;
    expect(validateMagicBytes(buf, "image/heic")).toBe(true);
    expect(validateMagicBytes(buf, "image/heif")).toBe(true);
  });
  it("rejects buffer too small", () => {
    expect(validateMagicBytes(Buffer.from("tiny"), "application/pdf")).toBe(false);
  });
  it("rejects unknown MIME type", () => {
    expect(validateMagicBytes(Buffer.alloc(16), "text/html")).toBe(false);
  });
});
