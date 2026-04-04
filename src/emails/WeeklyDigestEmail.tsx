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

interface IncompleteForm {
  id: string;
  title: string;
  completionPct: number;
  updatedAt: string; // ISO date string
}

interface Props {
  name?: string;
  formCount: number;
  forms: IncompleteForm[];
  profileScore: number;
  missingCategories: string[];
  primaryFormId: string;
  appUrl: string;
  unsubscribeUrl: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function WeeklyDigestEmail({
  name,
  formCount,
  forms,
  profileScore,
  missingCategories,
  primaryFormId,
  appUrl,
  unsubscribeUrl,
}: Props) {
  const firstName = name?.split(" ")[0] ?? "there";
  const ctaUrl = `${appUrl}/dashboard/forms/${primaryFormId}`;
  const subject =
    formCount === 1
      ? "You have 1 form waiting — pick up where you left off"
      : `You have ${formCount} forms waiting — pick up where you left off`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={logo}>
            Form<span style={logoBlue}>Pilot</span>
          </Heading>

          <Heading style={h1}>
            {formCount === 1
              ? "You have a form waiting"
              : `You have ${formCount} forms waiting`}
          </Heading>

          <Text style={text}>Hey {firstName},</Text>

          <Text style={text}>
            {formCount === 1
              ? "You started filling a form in FormPilot but haven't finished yet. It's still saved where you left off."
              : `You have ${formCount} forms in FormPilot that are partially filled. They're still saved where you left off.`}
          </Text>

          {/* Forms list */}
          {forms.map((form) => (
            <div key={form.id} style={formRow}>
              <div style={formMeta}>
                <strong style={formTitle}>{form.title}</strong>
                <span style={formDetail}>
                  {form.completionPct}% complete &middot; last edited {formatDate(form.updatedAt)}
                </span>
              </div>
            </div>
          ))}

          {/* Profile nudge — only if incomplete */}
          {profileScore < 100 && missingCategories.length > 0 && (
            <Text style={text}>
              <strong>Tip:</strong> Your profile is {profileScore}% complete. Adding{" "}
              {missingCategories.slice(0, 2).join(" and ")} will help FormPilot autofill
              more fields automatically.
            </Text>
          )}

          <Section style={buttonContainer}>
            <Button style={button} href={ctaUrl}>
              Continue filling
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You&apos;re receiving this weekly digest from FormPilot because you have incomplete
            forms.{" "}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe from digest emails
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

const formRow = {
  padding: "12px 16px",
  backgroundColor: "#f8fafc",
  borderRadius: "10px",
  marginBottom: "8px",
};

const formMeta = {
  display: "flex" as const,
  flexDirection: "column" as const,
  gap: "2px",
};

const formTitle = {
  color: "#0f172a",
  fontSize: "14px",
};

const formDetail = {
  color: "#64748b",
  fontSize: "12px",
};

const buttonContainer = { textAlign: "left" as const, marginBottom: "24px", marginTop: "24px" };

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
