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

interface StaleForm {
  id: string;
  title: string;
  category: string | null;
  completionPct: number;
}

interface Props {
  staleCount: number;
  forms: StaleForm[];
  unsubscribeUrl: string;
  appUrl: string;
}

export default function StaleFormsDigestEmail({
  staleCount,
  forms,
  unsubscribeUrl,
  appUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`You have ${staleCount} form${staleCount !== 1 ? "s" : ""} waiting to be finished in FormPilot.`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>
            {`${staleCount} form${staleCount !== 1 ? "s" : ""} waiting to be finished`}
          </Heading>

          <Text style={text}>
            You have forms you started in FormPilot that haven&apos;t been touched in a while.
            Pick up where you left off — most users finish in under 20 minutes with autofill.
          </Text>

          {forms.map((form) => (
            <Section key={form.id} style={formCard}>
              <Text style={formTitle}>{form.title}</Text>
              {form.category && (
                <Text style={formMeta}>{form.category}</Text>
              )}
              <Text style={formMeta}>{form.completionPct}% complete</Text>
              <Button href={`${appUrl}/dashboard/forms/${form.id}`} style={button}>
                Continue →
              </Button>
            </Section>
          ))}

          <Hr style={hr} />

          <Text style={footer}>
            FormPilot · {appUrl} ·{" "}
            <a href={`${appUrl}/privacy`} style={link}>
              Privacy Policy
            </a>
            <br />
            Don&apos;t want these weekly summaries?{" "}
            <a href={unsubscribeUrl} style={link}>
              Stop these reminders
            </a>
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
const formCard = {
  borderLeft: "3px solid #2563eb",
  paddingLeft: "16px",
  marginBottom: "24px",
};
const formTitle = { fontSize: "16px", fontWeight: "600", color: "#0f172a", margin: "0 0 4px" };
const formMeta = { fontSize: "13px", color: "#94a3b8", margin: "0 0 8px" };
const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "10px 20px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e2e8f0", margin: "32px 0 24px" };
const footer = { fontSize: "13px", color: "#94a3b8", lineHeight: "20px" };
const link = { color: "#94a3b8" };
