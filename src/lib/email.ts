import { Resend } from "resend";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = "FormPilot <hello@getformpilot.com>";

export async function sendEmail(
  to: string,
  subject: string,
  template: ReactElement
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // Skip silently in dev/test environments without a key configured
    return;
  }
  // In local development, require explicit opt-in via SEND_EMAILS=true to avoid
  // accidentally sending emails during development/testing
  if (process.env.NODE_ENV !== "production" && process.env.SEND_EMAILS !== "true") {
    return;
  }
  const html = await render(template);
  await getResend().emails.send({ from: FROM, to, subject, html });
}
