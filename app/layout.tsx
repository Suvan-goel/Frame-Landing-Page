import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MetaPixelRouteGuard } from "./components/meta-pixel";
import { StructuredData } from "./components/structured-data";
import {
  ORGANIZATION_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";
import "./admin-email-pages.css";
import "./admin-workspace.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Frame | Ultrasound Wearable for Blood Pressure Patterns",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "health technology",
  authors: [{ name: ORGANIZATION_NAME, url: SITE_URL }],
  creator: ORGANIZATION_NAME,
  publisher: ORGANIZATION_NAME,
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
    siteName: SITE_NAME,
    locale: "en_GB",
    url: SITE_URL,
    images: [
      {
        url: "/og-launch-v2.png",
        width: 1732,
        height: 908,
        alt: "Frame: See how your blood pressure responds to daily life.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "See how your cardiovascular system responds to daily life.",
    description:
      "Frame is developing a screenless, non-invasive ultrasound wearable for blood pressure in context.",
    images: ["/og-launch-v2.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

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
    <html lang="en-GB">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StructuredData />
        <MetaPixelRouteGuard />
        {children}
      </body>
    </html>
  );
}
