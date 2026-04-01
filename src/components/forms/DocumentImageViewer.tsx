"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { FormField } from "@/lib/ai/analyze-form";
import { matchAnnotationToField } from "@/lib/pdf/annotation-helpers";
import { getUIString } from "@/lib/i18n";

// PDF.js worker via CDN — no native binaries needed, works on Vercel
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldCoord {
  x: number; y: number; w: number; h: number; page: number;
}

function clampCoord(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface Props {
  formId: string;
  sourceType: string;
  fields: FormField[];
  activeFieldId: string | null;
  liveValues?: Record<string, string>;
  onFieldSelect?: (fieldId: string) => void;
  /** On mobile: render a collapsed thumbnail strip with tap-to-expand. Desktop always shows full. */
  mobileCollapsed?: boolean;
  language?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

export default function DocumentImageViewer({
  formId,
  sourceType,
  fields,
  activeFieldId,
  liveValues = {},
  onFieldSelect,
  mobileCollapsed = false,
  language,
}: Props) {
  const docLabel = getUIString(language, "originalDocument");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFit, setIsFit] = useState(true);
  // fieldId -> normalized 0-1 coordinates derived from PDF annotations
  const [annotCoords, setAnnotCoords] = useState<Record<string, FieldCoord>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<unknown>(null);

  function zoomIn() {
    setIsFit(false);
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100));
  }
  function zoomOut() {
    setIsFit(false);
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100));
  }
  function resetZoom() {
    setIsFit(true);
    setZoom(1);
  }

  const fileUrl = `/api/forms/${formId}/file`;

  // Merge annotation-derived coords with AI-extracted coords (AI coords take priority if present)
  function getCoords(field: FormField): FieldCoord | null {
    if (sourceType === "PDF") {
      return annotCoords[field.id] ?? field.coordinates ?? null;
    }
    if (field.coordinates) return field.coordinates;
    return annotCoords[field.id] ?? null;
  }

  const activeField = activeFieldId ? fields.find((f) => f.id === activeFieldId) : null;
  const activeCoords = activeField ? getCoords(activeField) : null;

  useEffect(() => {
    if (activeCoords?.page && activeCoords.page !== currentPage) {
      setCurrentPage(activeCoords.page);
    }
  }, [activeCoords?.page, currentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setContainerSize({
        w: container.clientWidth,
        h: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /**
   * After a page renders, extract AcroForm annotations for that page and
   * convert their rect [x1,y1,x2,y2] to 0-1 fractions of page dimensions.
   */
  const extractAnnotations = useCallback(
    async (pageNum: number, pageWidthPt: number, pageHeightPt: number) => {
      if (!pdfDocRef.current) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfDoc = pdfDocRef.current as any;
        const page = await pdfDoc.getPage(pageNum);
        const annotations = await page.getAnnotations();
        const orderFallbackEligible =
          pageNum === 1 &&
          !fields.some((field) => field.coordinates) &&
          annotations.length === fields.length;
        const claimedFieldIds = new Set<string>();

        const newCoords: Record<string, FieldCoord> = {};
        for (const [annotationIndex, annot] of annotations.entries()) {
          if (!annot.rect) continue;
          let fieldId = matchAnnotationToField(annot, fields);
          if (orderFallbackEligible && (!fieldId || claimedFieldIds.has(fieldId))) {
            const fallbackField = fields[annotationIndex];
            if (fallbackField && !claimedFieldIds.has(fallbackField.id)) {
              fieldId = fallbackField.id;
            }
          }
          if (!fieldId) continue;
          claimedFieldIds.add(fieldId);

          const [x1, y1, x2, y2] = annot.rect as number[];
          // PDF coordinate system: y=0 is bottom. Convert to top-left origin.
          const rawX = x1 / pageWidthPt;
          const rawY = 1 - y2 / pageHeightPt; // flip y
          const rawW = (x2 - x1) / pageWidthPt;
          const rawH = (y2 - y1) / pageHeightPt;
          const w = clampCoord(rawW, 0.005, 1);
          const h = clampCoord(rawH, 0.005, 1);
          const x = clampCoord(rawX, 0, Math.max(0, 1 - w));
          const y = clampCoord(rawY, 0, Math.max(0, 1 - h));

          newCoords[fieldId] = { x, y, w, h, page: pageNum };
        }

        if (Object.keys(newCoords).length > 0) {
          setAnnotCoords((prev) => ({ ...prev, ...newCoords }));
        }
      } catch {
        // Annotation extraction is best-effort
      }
    },
    [fields]
  );

  const zoomControls = (
    <div className="flex items-center gap-1">
      <button
        onClick={zoomOut}
        disabled={!isFit && zoom <= MIN_ZOOM}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button
        onClick={resetZoom}
        className="min-w-[3rem] text-xs tabular-nums text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded px-1 py-1 transition-colors"
        title="Reset to fit"
      >
        {isFit ? "Fit" : `${Math.round(zoom * 100)}%`}
      </button>
      <button
        onClick={zoomIn}
        disabled={!isFit && zoom >= MAX_ZOOM}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
    </div>
  );

  // IMAGE sourceType: just render the raw image
  if (sourceType === "IMAGE") {
    if (mobileCollapsed) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 min-h-[48px]"
            aria-expanded={mobileExpanded}
            aria-controls="mobile-doc-viewer"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            <span className="text-xs font-medium text-slate-600">{docLabel}</span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mobileExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {mobileExpanded && (
            <div id="mobile-doc-viewer" className="overflow-auto bg-slate-100 p-3" style={{ maxHeight: "60vh" }}>
              <div className="relative inline-block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl}
                  alt="Original document"
                  className="w-full h-auto rounded shadow block"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
                  }}
                />
                {renderedSize && fields.map((field) => {
                  const c = getCoords(field);
                  if (!c || c.page !== 1) return null;
                  const isActive = field.id === activeFieldId;
                  const value = liveValues[field.id];
                  return <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} fieldType={field.type} />;
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-end px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
          {zoomControls}
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
        <div
          className="relative inline-block shadow"
          style={{ width: isFit ? "100%" : `${zoom * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt="Original document"
            className="w-full h-auto rounded block"
            onLoad={(e) => {
              const img = e.currentTarget;
              setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
            }}
          />
          {renderedSize && fields.map((field) => {
            const c = getCoords(field);
            if (!c || c.page !== 1) return null;
            const isActive = field.id === activeFieldId;
            const value = liveValues[field.id];
            return (
              <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} fieldType={field.type} />
            );
          })}
        </div>
        </div>
      </div>
    );
  }

  // PDF / WORD: render with react-pdf client-side
  const pageFitMargin = 64;
  const fitPageHeight = containerSize ? Math.max(containerSize.h - pageFitMargin, 240) : null;
  const fitPageWidth = containerSize
    ? Math.min(containerSize.w - pageFitMargin, pageAspectRatio && fitPageHeight ? fitPageHeight * pageAspectRatio : 900)
    : 700;
  // When zoomed: always pass an explicit width; when fit: use original auto-fit logic
  const maxPageHeight = isFit ? fitPageHeight : null;
  const maxPageWidth = isFit ? fitPageWidth : fitPageWidth * zoom;

  if (mobileCollapsed) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 min-h-[48px]"
          aria-expanded={mobileExpanded}
          aria-controls="mobile-doc-viewer-pdf"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs font-medium text-slate-600">{docLabel}</span>
            {totalPages > 1 && (
              <span className="text-xs text-slate-400">({totalPages} pages)</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mobileExpanded ? "rotate-180" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {mobileExpanded && (
          <div id="mobile-doc-viewer-pdf" className="flex flex-col" style={{ maxHeight: "60vh" }}>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="text-xs text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-slate-100 flex justify-center items-start p-3 pb-6">
              <Document
                file={fileUrl}
                onLoadSuccess={(doc) => {
                  setTotalPages(doc.numPages);
                  pdfDocRef.current = doc;
                }}
                loading={<Spinner />}
                error={<DocError />}
              >
                <div className="relative inline-block shadow-lg mb-3">
                  <Page
                    pageNumber={currentPage}
                    height={maxPageHeight ?? undefined}
                    width={maxPageHeight ? undefined : maxPageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onRenderSuccess={(page) => {
                      setRenderedSize({ w: page.width, h: page.height });
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const orig = page as any;
                      const ptW = orig.originalWidth ?? orig.width;
                      const ptH = orig.originalHeight ?? orig.height;
                      setPageAspectRatio(ptW / ptH);
                      extractAnnotations(currentPage, ptW, ptH);
                    }}
                  />
                  {renderedSize && fields.map((field) => {
                    const c = getCoords(field);
                    if (!c || c.page !== currentPage) return null;
                    const isActive = field.id === activeFieldId;
                    const value = liveValues[field.id];
                    return (
                      <FieldOverlay
                        key={field.id}
                        c={c}
                        isActive={isActive}
                        value={value}
                        fieldType={field.type}
                        onClick={() => onFieldSelect?.(field.id)}
                      />
                    );
                  })}
                </div>
              </Document>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar: page navigation + zoom controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-xs text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        ) : <div />}
        {zoomControls}
      </div>

      {/* PDF canvas + overlays */}
      <div ref={containerRef} className={`flex-1 min-h-0 overflow-auto bg-slate-100 p-4 pb-8 ${isFit ? "flex justify-center items-start" : ""}`}>
        <Document
          file={fileUrl}
          onLoadSuccess={(doc) => {
            setTotalPages(doc.numPages);
            // Store raw pdfjs doc reference for annotation extraction
            pdfDocRef.current = doc;
          }}
          loading={<Spinner />}
          error={<DocError />}
        >
          <div className="relative inline-block shadow-lg mb-4">
            <Page
              pageNumber={currentPage}
              height={maxPageHeight ?? undefined}
              width={maxPageHeight ? undefined : maxPageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={(page) => {
                setRenderedSize({ w: page.width, h: page.height });
                // Extract annotations using PDF point dimensions (not rendered px)
                // page.originalWidth/originalHeight are in PDF units (points)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const orig = page as any;
                const ptW = orig.originalWidth ?? orig.width;
                const ptH = orig.originalHeight ?? orig.height;
                setPageAspectRatio(ptW / ptH);
                extractAnnotations(currentPage, ptW, ptH);
              }}
            />

            {/* Field overlays */}
            {renderedSize && fields.map((field) => {
              const c = getCoords(field);
              if (!c || c.page !== currentPage) return null;
              const isActive = field.id === activeFieldId;
              const value = liveValues[field.id];
              return (
                <FieldOverlay
                  key={field.id}
                  c={c}
                  isActive={isActive}
                  value={value}
                  fieldType={field.type}
                  onClick={() => onFieldSelect?.(field.id)}
                />
              );
            })}
          </div>
        </Document>
      </div>

      {/* Footer hint */}
      {activeField && !activeCoords && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> — location not found in document</span>
        </div>
      )}

      {activeField && activeCoords && activeCoords.page !== currentPage && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> is on page {activeCoords.page}</span>
          <button onClick={() => setCurrentPage(activeCoords.page)} className="ml-auto underline hover:no-underline">
            Jump there
          </button>
        </div>
      )}
    </div>
  );
}

/** Absolutely-positioned overlay for a single field */
function FieldOverlay({
  c,
  isActive,
  value,
  fieldType,
  onClick,
}: {
  c: FieldCoord;
  isActive: boolean;
  value: string | undefined;
  fieldType?: string;
  onClick?: () => void;
}) {
  const isCheckbox = fieldType === "checkbox";
  const isChecked = isCheckbox && value === "Checked";

  return (
    <button
      type="button"
      className={`absolute overflow-hidden cursor-pointer ${isCheckbox ? "flex items-center justify-center" : "flex items-center"}`}
      aria-label="Jump to matching form field"
      onClick={onClick}
      style={{
        left: `${c.x * 100}%`,
        top: `${c.y * 100}%`,
        width: `${c.w * 100}%`,
        height: `${c.h * 100}%`,
        border: isActive ? "2px solid rgba(217, 119, 6, 0.9)" : "none",
        backgroundColor: isActive ? "rgba(251, 191, 36, 0.18)" : "transparent",
        borderRadius: "2px",
        boxShadow: isActive ? "0 0 0 3px rgba(251, 191, 36, 0.2)" : "none",
        paddingLeft: "3px",
        paddingRight: "3px",
        transition: "background-color 0.15s, border-color 0.15s",
        zIndex: isActive ? 2 : 1,
        background: isActive ? "rgba(251, 191, 36, 0.18)" : "transparent",
      }}
    >
      {isChecked ? (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          style={{
            width: "96%",
            height: "96%",
            color: "#1d4ed8",
          }}
        >
          <path
            d="M4 10.5 8 14.5 16 6.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : value && !isCheckbox && (
        <span
          style={{
            fontSize: "clamp(7px, 1.5cqw, 13px)",
            color: "#1d4ed8",
            fontFamily: "Arial, sans-serif",
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            width: "100%",
            display: "block",
          }}
        >
          {value}
        </span>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64 w-64">
      <svg className="w-6 h-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
      </svg>
    </div>
  );
}

function DocError() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-64 text-slate-400 text-sm">
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p>Could not load document</p>
    </div>
  );
}
