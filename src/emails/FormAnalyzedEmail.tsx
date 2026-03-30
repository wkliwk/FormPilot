import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface Props {
  formTitle: string;
  formId: string;
  fieldCount: number;
  appUrl: string;
}

export default function FormAnalyzedEmail({ formTitle, formId, fieldCount, appUrl }: Props) {
  const formUrl = `${appUrl}/dashboard/forms/${formId}`;

  return (
    <Html>
      <Head />
      <Preview>{`Your form "${formTitle}" is ready to fill — ${String(fieldCount)} fields found`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Your form is ready to fill</Heading>

          <Text style={text}>
            <strong>{formTitle}</strong> has been analyzed.
            We found <strong>{fieldCount} field{fieldCount !== 1 ? "s" : ""}</strong> — each
            one explained in plain language with autofill suggestions from your profile.
          </Text>

          <Button style={button} href={formUrl}>
            Start filling →
          </Button>

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            You&apos;re receiving this because you uploaded a form to FormPilot.
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
const text = { fontSize: "16px", lineHeight: "24px", color: "#475569", margin: "0 0 24px" };
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
