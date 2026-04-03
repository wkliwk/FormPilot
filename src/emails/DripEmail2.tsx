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

export default function DripEmail2({ name, appUrl, unsubscribeUrl }: Props) {
  const firstName = name?.split(" ")[0] ?? "there";
  const profileUrl = `${appUrl}/dashboard/profile`;

  return (
    <Html>
      <Head />
      <Preview>Your profile is 80% of the work — fill it once, autofill everything</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Your profile is 80% of the work</Heading>

          <Text style={text}>Hey {firstName},</Text>

          <Text style={text}>
            You signed up for FormPilot — but haven&apos;t filled your first form yet. The fastest way to get started is to complete your profile first.
          </Text>

          <Text style={text}>
            Your profile stores your name, address, date of birth, and other details <strong>once</strong>. After that, FormPilot uses it to autofill those same fields on every form you upload — tax forms, immigration applications, job applications, healthcare forms.
          </Text>

          <Text style={text}>
            Most users complete their profile in under 3 minutes and then watch their first form fill in seconds.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={profileUrl}>
              Complete my profile
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
