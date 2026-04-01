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
  name?: string;
  formsUsed: number;
  limit: number;
  appUrl: string;
}

export default function QuotaApproachingEmail({ name, formsUsed, limit, appUrl }: Props) {
  const remaining = limit - formsUsed;
  const billingUrl = `${appUrl}/dashboard/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`You have ${remaining} free form${remaining !== 1 ? "s" : ""} left this month`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>FormPilot</Heading>
          <Hr style={hr} />
          <Text style={paragraph}>
            {name ? `Hi ${name},` : "Hi there,"}
          </Text>
          <Text style={paragraph}>
            You&apos;ve used <strong>{formsUsed} of {limit}</strong> free forms this month.
            You have <strong>{remaining}</strong> remaining.
          </Text>
          <Text style={paragraph}>
            Upgrade to Pro for unlimited form uploads — no monthly caps.
          </Text>
          <Button style={button} href={billingUrl}>
            Upgrade to Pro
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            FormPilot — AI Form Assistant
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "560px",
};

const logo = {
  fontSize: "24px",
  fontWeight: "bold" as const,
  textAlign: "center" as const,
  margin: "0 0 20px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 40px",
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
  margin: "16px 40px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  padding: "0 40px",
};
