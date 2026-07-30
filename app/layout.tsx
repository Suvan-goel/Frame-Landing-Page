import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
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
    title: "Frame — Blood pressure in context",
    description:
      "Frame is developing a non-invasive ultrasound wearable to help people understand how their cardiovascular system responds to sleep, stress, exercise, and recovery.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "See how your cardiovascular system responds to daily life.",
      description:
        "Frame is developing a screenless, non-invasive ultrasound wearable for blood pressure in context.",
      type: "website",
      siteName: "Frame",
      images: [
        {
          url: `${baseUrl}/og.png`,
          width: 1731,
          height: 909,
          alt: "Frame — Blood pressure, in context.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "See how your cardiovascular system responds to daily life.",
      description:
        "Frame is developing a screenless, non-invasive ultrasound wearable for blood pressure in context.",
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
