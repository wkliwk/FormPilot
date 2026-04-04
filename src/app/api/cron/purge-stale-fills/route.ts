import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import type { FormField } from "@/lib/ai/analyze-form";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Forms in FILLING status older than 90 days with no filled values are deleted.
// Forms with some filled values are left intact — the user may still return.
const STALE_THRESHOLD_DAYS = 90;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  try {
    const candidates = await prisma.form.findMany({
      where: {
        status: "FILLING",
        updatedAt: { lt: cutoff },
      },
      select: { id: true, fields: true },
    });

    const toDelete: string[] = [];
    for (const form of candidates) {
      const fields = form.fields as unknown as FormField[];
      const hasAnyValue = fields.some((f) => f.value && String(f.value).trim());
      if (!hasAnyValue) {
        toDelete.push(form.id);
      }
    }

    let deleted = 0;
    if (toDelete.length > 0) {
      const result = await prisma.form.deleteMany({
        where: { id: { in: toDelete } },
      });
      deleted = result.count;
    }

    log.info("Purge-stale-fills cron complete", {
      route: "POST /api/cron/purge-stale-fills",
      candidates: candidates.length,
      deleted,
      skipped: candidates.length - toDelete.length,
    });

    return NextResponse.json({ candidates: candidates.length, deleted, skipped: candidates.length - toDelete.length });
  } catch (err) {
    log.error("Purge-stale-fills cron failed", {
      route: "POST /api/cron/purge-stale-fills",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
