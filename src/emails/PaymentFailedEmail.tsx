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
  appUrl: string;
}

export default function PaymentFailedEmail({ name, appUrl }: Props) {
  const firstName = name?.split(" ")[0] ?? "there";

  return (
    <Html>
      <Head />
      <Preview>Action required: your FormPilot payment failed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>Payment failed, {firstName}</Heading>

          <Text style={text}>
            We weren&apos;t able to charge your card for your FormPilot Pro
            subscription. Your account has been moved to past due.
          </Text>

          <Text style={text}>
            To keep your Pro access, please update your payment method as soon
            as possible. If payment isn&apos;t resolved, your account will be
            downgraded to the free plan.
          </Text>

          <Button style={button} href={`${appUrl}/dashboard/billing`}>
            Update payment method
          </Button>

          <Text style={helpText}>
            If you have any questions, reply to this email and we&apos;ll help
            you out.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            You&apos;re receiving this because you have a FormPilot Pro
            subscription.
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
  backgroundColor: "#dc2626",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const helpText = { fontSize: "14px", lineHeight: "22px", color: "#64748b", margin: "24px 0 0" };
const hr = { borderColor: "#e2e8f0", margin: "32px 0 24px" };
const footer = { fontSize: "13px", color: "#94a3b8", lineHeight: "20px" };
const link = { color: "#94a3b8" };
