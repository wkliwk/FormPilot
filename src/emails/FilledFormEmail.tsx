import {
  Body,
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
  senderMessage?: string;
}

export default function FilledFormEmail({ formTitle, senderMessage }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your completed {formTitle} is attached</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Form attached: {formTitle}</Heading>

          {senderMessage ? (
            <Text style={text}>{senderMessage}</Text>
          ) : (
            <Text style={text}>
              Please find your completed <strong>{formTitle}</strong> attached to this email.
            </Text>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Sent via FormPilot — form filling made simple.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f9fafb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "40px auto", padding: "32px", borderRadius: "12px", maxWidth: "560px", border: "1px solid #e5e7eb" };
const logo = { fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: "0 0 24px" };
const logoBlue = { color: "#2563eb" };
const h1 = { fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: "0 0 16px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#374151", margin: "0 0 16px" };
const hr = { borderColor: "#e5e7eb", margin: "24px 0 16px" };
const footer = { fontSize: "12px", color: "#9ca3af", margin: "0" };
