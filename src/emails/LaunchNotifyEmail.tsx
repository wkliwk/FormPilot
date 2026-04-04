import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

interface Props {
  phUrl: string;
}

export default function LaunchNotifyEmail({ phUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>FormPilot is live on Product Hunt — go upvote now!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>
          <Heading style={h1}>We're live on Product Hunt! 🎉</Heading>
          <Text style={text}>
            You signed up to be notified when FormPilot launched. Today's the day.
          </Text>
          <Text style={text}>
            We're live on Product Hunt right now. An upvote in the first few hours makes a
            huge difference — it helps more people discover a tool that makes paperwork
            painless.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={phUrl}>
              Upvote FormPilot on Product Hunt
            </Button>
          </Section>
          <Text style={footer}>
            You're receiving this because you signed up for a launch notification at
            getformpilot.com. This is a one-time email.
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
const logo = { fontSize: "20px", fontWeight: "700", color: "#1e293b", marginBottom: "32px" };
const logoBlue = { color: "#2563eb" };
const h1 = { color: "#1e293b", fontSize: "22px", fontWeight: "700", lineHeight: "1.3", marginBottom: "16px" };
const text = { color: "#475569", fontSize: "15px", lineHeight: "1.6", marginBottom: "16px" };
const buttonContainer = { textAlign: "left" as const, marginBottom: "24px", marginTop: "24px" };
const button = {
  backgroundColor: "#da552f",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const footer = { color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" };
