import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface Props {
  userName: string;
  verifyUrl: string;
}

export default function VerificationEmail({ userName, verifyUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verify your FormPilot email address</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "-apple-system, sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", backgroundColor: "#ffffff", borderRadius: 12, padding: "32px 40px" }}>
          <Heading style={{ fontSize: 22, color: "#0f172a", marginBottom: 8 }}>
            Confirm your email
          </Heading>
          <Text style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>
            Hi {userName}, click the button below to verify your FormPilot account.
            The link expires in 24 hours.
          </Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button
              href={verifyUrl}
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                borderRadius: 8,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Verify email
            </Button>
          </Section>
          <Text style={{ color: "#94a3b8", fontSize: 13 }}>
            If you didn&apos;t create a FormPilot account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
