import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MetaPixelRouteGuard } from "./components/meta-pixel";
import { StructuredData } from "./components/structured-data";
import {
  LEGACY_SITE_DESCRIPTION,
  ORGANIZATION_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import "./globals.css";
import "./home-preorder-responsive.css";
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

export async function generateMetadata(): Promise<Metadata> {
  const description = (await isPreorderSalesPageEnabled())
    ? SITE_DESCRIPTION
    : LEGACY_SITE_DESCRIPTION;

  return {
    metadataBase: new URL(SITE_URL),
    title: "Frame | Ultrasound Wearable for Blood Pressure Patterns",
    description,
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
      icon: "/favicon-transparent.png",
      shortcut: "/favicon-transparent.png",
      apple: "/favicon.png",
    },
    openGraph: {
      title: "See how your cardiovascular system responds to daily life.",
      description,
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
      description,
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
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f3efe6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preorderSalesEnabled = await isPreorderSalesPageEnabled();
  const description = preorderSalesEnabled
    ? SITE_DESCRIPTION
    : LEGACY_SITE_DESCRIPTION;

  return (
    <html lang="en-GB">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StructuredData description={description} />
        {children}
        <MetaPixelRouteGuard useRedesignedConsent={preorderSalesEnabled} />
      </body>
    </html>
  );
}
