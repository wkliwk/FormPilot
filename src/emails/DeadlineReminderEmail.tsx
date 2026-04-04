import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface Props {
  formTitle: string;
  formId: string;
  daysUntilDue: number;
  dueDateFormatted: string;
  unsubscribeUrl: string;
  appUrl: string;
}

export default function DeadlineReminderEmail({
  formTitle,
  formId,
  daysUntilDue,
  dueDateFormatted,
  unsubscribeUrl,
  appUrl,
}: Props) {
  const formUrl = `${appUrl}/dashboard/forms/${formId}`;

  const urgencyLine =
    daysUntilDue <= 1
      ? "⚠️ Due tomorrow — don't miss it"
      : `Due in ${daysUntilDue} days`;

  const previewText =
    daysUntilDue <= 1
      ? `${formTitle} is due tomorrow — open it now`
      : `${formTitle} is due in ${daysUntilDue} days — finish it with FormPilot`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Section style={card}>
            <Heading as="h2" style={h2}>
              {urgencyLine}
            </Heading>
            <Text style={paragraph}>
              Your form <strong>{formTitle}</strong> is due on{" "}
              <strong>{dueDateFormatted}</strong>.
              {daysUntilDue <= 1
                ? " Don't miss the deadline — open it now and let FormPilot finish filling it."
                : " Open it now and use AI autofill to complete it before the deadline."}
            </Text>
            <Button style={button} href={formUrl}>
              Open {formTitle} →
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You&apos;re receiving this because you set a deadline on this form.{" "}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe from deadline reminders
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f8fafc", fontFamily: "sans-serif" };
const container = { maxWidth: "560px", margin: "0 auto", padding: "24px 16px" };
const logo = { fontSize: "22px", fontWeight: 700, color: "#0f172a", marginBottom: "24px" };
const logoBlue = { color: "#2563eb", fontWeight: 300 };
const card = { backgroundColor: "#ffffff", borderRadius: "12px", padding: "28px 32px", border: "1px solid #e2e8f0" };
const h2 = { fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px" };
const paragraph = { fontSize: "15px", color: "#475569", lineHeight: "1.6", margin: "0 0 20px" };
const button = { backgroundColor: "#2563eb", color: "#ffffff", borderRadius: "8px", padding: "12px 24px", fontSize: "15px", fontWeight: 600, textDecoration: "none", display: "inline-block" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
const footer = { fontSize: "12px", color: "#94a3b8", textAlign: "center" as const };
const link = { color: "#64748b" };
