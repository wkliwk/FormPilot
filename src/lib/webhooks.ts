import { prisma } from "@/lib/prisma";
import crypto from "crypto";

interface WebhookPayload {
  event: "form.completed";
  formId: string;
  title: string;
  category: string | null;
  completedAt: string;
  autofillRate: number | null;
  fieldCount: number;
  fieldsFilledCount: number;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fire all enabled webhooks for a user when a form is completed.
 * Fire-and-forget — failures are silently ignored.
 */
export async function fireWebhooks(userId: string, payload: WebhookPayload): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { userId, enabled: true },
    select: { url: true, secret: true },
  });

  if (webhooks.length === 0) return;

  const body = JSON.stringify(payload);

  // Fire all webhooks in parallel, don't await results
  for (const webhook of webhooks) {
    const signature = signPayload(body, webhook.secret);

    fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FormPilot-Signature": signature,
        "X-FormPilot-Event": "form.completed",
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    }).catch(() => {
      // Silently ignore delivery failures — fire-and-forget in v1
    });
  }
}
