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
  name?: string;
  appUrl: string;
}

export default function WelcomeEmail({ name, appUrl }: Props) {
  const firstName = name?.split(" ")[0] ?? "there";

  return (
    <Html>
      <Head />
      <Preview>Welcome to FormPilot — your AI form assistant is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Welcome, {firstName}!</Heading>

          <Text style={text}>
            You&apos;re all set. FormPilot helps you fill complex forms —
            tax returns, visa applications, government paperwork — with
            AI-powered explanations and smart autofill from your secure profile.
          </Text>

          <Section style={featureList}>
            <Text style={featureItem}>✓ Upload PDF or Word forms</Text>
            <Text style={featureItem}>✓ Get plain-language explanations for every field</Text>
            <Text style={featureItem}>✓ Autofill from your saved profile</Text>
            <Text style={featureItem}>✓ Form Memory learns from forms you complete</Text>
          </Section>

          <Text style={text}>
            Your free plan includes <strong>5 form uploads per month</strong>.
            Upgrade to Pro for unlimited uploads at $9/month.
          </Text>

          <Button style={button} href={`${appUrl}/dashboard`}>
            Upload your first form
          </Button>

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            You&apos;re receiving this because you created a FormPilot account.
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
const featureList = { margin: "0 0 24px", paddingLeft: "8px" };
const featureItem = { fontSize: "15px", lineHeight: "24px", color: "#334155", margin: "0 0 4px" };
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
