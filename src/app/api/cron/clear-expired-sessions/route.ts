import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Sessions idle longer than this are considered expired and cleared
const SESSION_EXPIRY_DAYS = Number(process.env.SESSION_EXPIRY_DAYS ?? "30");

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Find FILLING forms that haven't been touched since the cutoff
    const expired = await prisma.form.findMany({
      where: { status: "FILLING", updatedAt: { lt: cutoff } },
      select: { id: true, fields: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ cleared: 0 });
    }

    // Reset each form: clear per-field values and revert status to ANALYZED
    await Promise.all(
      expired.map((form) => {
        const fields = (form.fields as Array<Record<string, unknown>>).map((f) => {
          const cleared: Record<string, unknown> = { ...f };
          delete cleared["value"];
          delete cleared["fieldState"];
          return cleared;
        });
        return prisma.form.update({
          where: { id: form.id },
          data: { fields: fields as object[], filledData: {}, status: "ANALYZED" },
        });
      })
    );

    log.info("Cleared expired fill sessions", {
      route: "POST /api/cron/clear-expired-sessions",
      cleared: expired.length,
      expiryDays: SESSION_EXPIRY_DAYS,
    });

    return NextResponse.json({ cleared: expired.length });
  } catch (err) {
    log.error("Failed to clear expired sessions", { error: err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
