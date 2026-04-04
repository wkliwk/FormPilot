import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;

export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get("formId");
  if (!formId) {
    return new Response("Missing formId", { status: 400 });
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: {
      title: true,
      category: true,
      status: true,
      autofillRate: true,
      fields: true,
      completedAt: true,
      // Deliberately NOT selecting: userId, fields values, filledData
    },
  });

  if (!form || form.status !== "COMPLETED") {
    return new Response("Not found", { status: 404 });
  }

  const fields = form.fields as Array<{ value?: string }>;
  const totalFields = fields.length;
  const filledFields = fields.filter((f) => f.value && String(f.value).trim()).length;
  const autofillPct = form.autofillRate != null ? Math.round(form.autofillRate) : null;
  const category = form.category?.replace(/_/g, " ") ?? null;

  const title = form.title.length > 60 ? form.title.slice(0, 57) + "…" : form.title;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #6366f1 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "56px 64px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>Form</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>Pilot</span>
            <span style={{ fontSize: 14, color: "#64748b", marginLeft: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Completion Certificate
            </span>
          </div>

          {/* Check + title */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
            Form Completed
          </div>

          <div style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", textAlign: "center", lineHeight: 1.2, marginBottom: 20 }}>
            {title}
          </div>

          {category && (
            <div
              style={{
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "6px 16px",
                borderRadius: "999px",
                marginBottom: 32,
              }}
            >
              {category}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 32, borderTop: "1px solid #f1f5f9", paddingTop: 24, width: "100%", justifyContent: "center" }}>
            {totalFields > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>{filledFields}</span>
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Fields filled</span>
              </div>
            )}
            {autofillPct != null && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#2563eb" }}>{autofillPct}%</span>
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>AI autofilled</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>✓ Verified</span>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>getformpilot.com</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
