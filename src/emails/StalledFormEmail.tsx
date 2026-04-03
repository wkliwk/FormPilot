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
  formTitle: string;
  formId: string;
  profileIsLow: boolean;
  unsubscribeUrl: string;
  appUrl: string;
}

export default function StalledFormEmail({
  formTitle,
  formId,
  profileIsLow,
  unsubscribeUrl,
  appUrl,
}: Props) {
  const formUrl = `${appUrl}/dashboard/forms/${formId}`;
  const profileUrl = `${appUrl}/dashboard/profile`;

  return (
    <Html>
      <Head />
      <Preview>{`Your ${formTitle} is waiting — let FormPilot fill it in`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>
            Your form is waiting to be filled
          </Heading>

          <Text style={text}>
            You uploaded <strong>{formTitle}</strong> to FormPilot a couple of days ago but
            haven&apos;t run autofill yet.
          </Text>

          <Text style={text}>
            FormPilot can automatically fill many fields using your saved profile —
            things like your name, address, employer, and contact details. Most users
            complete their form in under 10 minutes.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={formUrl}>
              Open form and autofill
            </Button>
          </Section>

          {profileIsLow && (
            <>
              <Hr style={hr} />
              <Text style={text}>
                <strong>Tip:</strong> Your profile looks incomplete. The more you add,
                the more FormPilot can fill in automatically. It only takes a minute.
              </Text>
              <Section style={buttonContainer}>
                <Button style={secondaryButton} href={profileUrl}>
                  Complete your profile first
                </Button>
              </Section>
            </>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            You&apos;re receiving this because you have a FormPilot account.{" "}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe from these reminders
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

const secondaryButton = {
  ...button,
  backgroundColor: "#f1f5f9",
  color: "#334155",
};

const hr = { borderColor: "#e2e8f0", margin: "24px 0" };

const footer = { color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" };

const link = { color: "#94a3b8" };
