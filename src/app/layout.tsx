import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocationGate } from "@/components/location-gate";
import { MobileBottomNav } from "@/components/mobile-app-chrome";
import { AppProviders } from "@/components/providers";
import {
  buildDefaultDescription,
  buildDefaultTitle,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultDescription = buildDefaultDescription();

export const metadata: Metadata = {
  title: {
    default: buildDefaultTitle(),
    template: `%s · ${SITE_NAME}`,
  },
  description: defaultDescription,
  keywords: [
    "AC Repair Gurugram",
    "AC Repair Hyderabad",
    "AC Repair Aligarh",
    "Washing Machine Repair",
    "Refrigerator Repair",
    "RO Service",
    "Chimney Cleaning",
    "Electrician",
    "Plumber",
    "Geyser Repair",
    "TV Repair",
    "Microwave Repair",
    "Appliance Repair",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: buildDefaultTitle(),
    description: defaultDescription,
    locale: "en_IN",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: buildDefaultTitle(),
    description: defaultDescription,
    images: ["/web-app-manifest-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <body className="flex min-h-full flex-col bg-[#F8F6F4] text-foreground md:bg-background">
        <AppProviders>
          <LocationGate />
          <SiteHeader />
          <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
          <div className="hidden md:block">
            <SiteFooter />
          </div>
          <MobileBottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
