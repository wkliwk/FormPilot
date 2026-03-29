import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

// GET /api/extension/download — serves formpilot-extension.zip from /public
export async function GET() {
  const zipPath = join(process.cwd(), "public", "formpilot-extension.zip");
  try {
    const data = await readFile(zipPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="formpilot-extension.zip"',
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Extension ZIP not found. Run npm run build:extension first." },
      { status: 404 }
    );
  }
}
