import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!form.fileBytes) {
    return NextResponse.json({ error: "No file data available" }, { status: 404 });
  }

  const pageParam = req.nextUrl.searchParams.get("page");
  const pageNum = pageParam ? parseInt(pageParam, 10) : 1;

  try {
    const pdfBuffer = Buffer.from(form.fileBytes);

    // pdfjs-dist is ESM-only; use dynamic import.
    // canvas package provides a Node.js-compatible Canvas API.
    const [pdfjsLib, canvasModule] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("canvas"),
    ]);
    const { createCanvas } = canvasModule;

    // Disable the web worker (not available in Node.js)
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      // @ts-expect-error - disableWorker is a valid runtime option but not typed
      disableWorker: true,
    });
    const pdfDoc = await loadingTask.promise;

    const totalPages = pdfDoc.numPages;
    const clampedPage = Math.min(Math.max(pageNum, 1), totalPages);

    const page = await pdfDoc.getPage(clampedPage);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvasWidth = Math.floor(viewport.width);
    const canvasHeight = Math.floor(viewport.height);

    // node-canvas createCanvas returns a Canvas with a getContext("2d") compatible with pdfjs
    const nodeCanvas = createCanvas(canvasWidth, canvasHeight);
    const context = nodeCanvas.getContext("2d");

    await page.render({
      // pdfjs-dist RenderParameters requires `canvas`; pass the node-canvas as HTMLCanvasElement
      canvas: nodeCanvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBuffer = nodeCanvas.toBuffer("image/png");

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Page-Count": String(totalPages),
        "X-Current-Page": String(clampedPage),
      },
    });
  } catch (err) {
    console.error("[render-page] Failed to render PDF page:", err);
    return NextResponse.json(
      { error: "Failed to render page" },
      { status: 500 }
    );
  }
}
