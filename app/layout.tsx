import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import {
  MetaPixelNoScript,
  MetaPixelScript,
} from "./components/meta-pixel";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    metadataBase: new URL(baseUrl),
    title: "Frame - Blood pressure in context",
    description:
      "Frame is developing a non-invasive ultrasound wearable to help people understand how their cardiovascular system responds to sleep, stress, exercise, and recovery.",
    applicationName: "Frame",
    category: "health technology",
    alternates: {
      canonical: "/",
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
      apple: "/favicon.png",
    },
    openGraph: {
      title: "See how your cardiovascular system responds to daily life.",
      description:
        "Frame is developing a screenless, non-invasive ultrasound wearable for blood pressure in context.",
      type: "website",
      siteName: "Frame",
      url: baseUrl,
      images: [
        {
          url: `${baseUrl}/og-launch-v2.png`,
          width: 1732,
          height: 908,
          alt: "Frame - See how your blood pressure responds to daily life.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "See how your cardiovascular system responds to daily life.",
      description:
        "Frame is developing a screenless, non-invasive ultrasound wearable for blood pressure in context.",
      images: [`${baseUrl}/og-launch-v2.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f3efe6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <MetaPixelScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MetaPixelNoScript />
        {children}
      </body>
    </html>
  );
}
