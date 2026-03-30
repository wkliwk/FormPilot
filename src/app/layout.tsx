import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

export const metadata: Metadata = {
  title: "FormPilot — AI Form Assistant",
  description:
    "Fill any PDF, Word doc, or web form with AI guidance. Auto-fill from your profile. Works with tax forms, visa applications, and government paperwork.",
  keywords: [
    "form filler",
    "AI form assistant",
    "PDF autofill",
    "tax form help",
    "visa form assistant",
    "government form filler",
    "PDF form fill",
  ],
  metadataBase: new URL(APP_URL),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FormPilot — AI Form Assistant",
    description:
      "Fill any PDF, Word doc, or web form with AI guidance. Auto-fill from your profile. Works with tax forms, visa applications, and government paperwork.",
    type: "website",
    url: APP_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FormPilot — AI Form Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FormPilot — AI Form Assistant",
    description:
      "Fill any PDF, Word doc, or web form with AI guidance. Auto-fill from your profile.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
