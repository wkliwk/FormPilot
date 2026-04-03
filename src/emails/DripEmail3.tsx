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
  unsubscribeUrl: string;
}

export default function DripEmail3({ name, appUrl, unsubscribeUrl }: Props) {
  const firstName = name?.split(" ")[0] ?? "there";
  const dashboardUrl = `${appUrl}/dashboard`;

  return (
    <Html>
      <Head />
      <Preview>See what FormPilot can do — upload a form in 60 seconds</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>See FormPilot in 60 seconds</Heading>

          <Text style={text}>Hey {firstName},</Text>

          <Text style={text}>
            A week ago you signed up for FormPilot but haven&apos;t filled a form yet. Here&apos;s the quick version of what FormPilot does:
          </Text>

          <Text style={text}>
            <strong>1.</strong> Upload any PDF form (tax return, visa application, job app).<br />
            <strong>2.</strong> FormPilot reads every field and explains what to put in each one.<br />
            <strong>3.</strong> Hit Autofill — your saved profile pre-fills name, address, employer, and more.<br />
            <strong>4.</strong> Review, tweak the few remaining fields, and export.
          </Text>

          <Text style={text}>
            Most users go from upload to a filled form in under 10 minutes — for forms that used to take an hour of hunting through paperwork.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Try it now — upload a form
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You&apos;re receiving this as part of your FormPilot welcome sequence.{" "}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe from these emails
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 48px",
  borderRadius: "12px",
  maxWidth: "560px",
};

const logo = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#1e293b",
  marginBottom: "32px",
};

const logoBlue = { color: "#2563eb" };

const h1 = {
  color: "#1e293b",
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: "1.3",
  marginBottom: "16px",
};

const text = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: "1.6",
  marginBottom: "16px",
};

const buttonContainer = { textAlign: "left" as const, marginBottom: "24px" };

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};

const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
const footer = { color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" };
const link = { color: "#94a3b8" };
