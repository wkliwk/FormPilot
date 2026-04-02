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
  filledCount: number;
  totalFields: number;
  dismissUrl: string;
  unsubscribeUrl: string;
  appUrl: string;
}

export default function FormAbandonedEmail({
  formTitle,
  formId,
  filledCount,
  totalFields,
  dismissUrl,
  unsubscribeUrl,
  appUrl,
}: Props) {
  const formUrl = `${appUrl}/dashboard/forms/${formId}`;
  const remaining = totalFields - filledCount;

  return (
    <Html>
      <Head />
      <Preview>Still need help with {formTitle}? Pick up where you left off.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Still working on {formTitle}?</Heading>

          <Text style={text}>
            You started filling out <strong>{formTitle}</strong> in FormPilot but
            haven&apos;t finished yet.
            {filledCount > 0
              ? ` You&apos;ve already filled ${filledCount} of ${totalFields} fields — just ${remaining} left to go.`
              : ` It has ${totalFields} fields and FormPilot can autofill many of them from your profile.`}
          </Text>

          <Text style={text}>
            FormPilot explains every field in plain English and uses your saved profile
            to suggest values. Most users finish in under 20 minutes.
          </Text>

          <Section style={{ margin: "24px 0" }}>
            <Button href={formUrl} style={button}>
              Continue filling {formTitle} →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            Not interested in this form anymore?{" "}
            <a href={dismissUrl} style={link}>
              Mark as done
            </a>
            {" · "}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe from all reminders
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif" };
const container = { margin: "0 auto", padding: "40px 20px", maxWidth: "560px" };
const logo = { fontSize: "24px", fontWeight: "800", color: "#0f172a", marginBottom: "32px" };
const logoBlue = { color: "#2563eb" };
const h1 = { fontSize: "24px", fontWeight: "700", color: "#0f172a", margin: "0 0 16px" };
const text = { fontSize: "16px", lineHeight: "24px", color: "#475569", margin: "0 0 16px" };
const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e2e8f0", margin: "32px 0 24px" };
const footer = { fontSize: "13px", color: "#94a3b8", lineHeight: "20px" };
const link = { color: "#94a3b8" };
