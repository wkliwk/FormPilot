import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Scrub PII fields — never send SSN, passport, tax IDs to Sentry
    const piiPattern = /ssn|passport|tax_id|taxid|password|creditcard|routingnumber|bankaccount/i;

    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (piiPattern.test(key)) {
          data[key] = "[Filtered]";
        }
      }
    }

    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (piiPattern.test(key)) {
          event.extra[key] = "[Filtered]";
        }
      }
    }

    return event;
  },
});
