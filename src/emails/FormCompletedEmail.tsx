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
  appUrl: string;
}

export default function FormCompletedEmail({ formTitle, formId, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your form &ldquo;{formTitle}&rdquo; is complete — ready to download</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Your form is ready</Heading>

          <Text style={text}>
            You&apos;ve completed <strong>{formTitle}</strong>. Head back to
            your dashboard to review the filled fields and export the finished
            document.
          </Text>

          <Button style={button} href={`${appUrl}/dashboard/forms/${formId}`}>
            View &amp; export form
          </Button>

          <Text style={tip}>
            <strong>Tip:</strong> FormPilot&apos;s Form Memory learns from
            forms you complete — next time you fill a similar form, your
            answers will be pre-suggested automatically.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            You&apos;re receiving this because you completed a form on
            FormPilot.
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
const tip = { fontSize: "14px", lineHeight: "22px", color: "#64748b", backgroundColor: "#f1f5f9", borderRadius: "8px", padding: "14px 16px", margin: "24px 0 0" };
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
