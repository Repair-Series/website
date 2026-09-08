import type { Metadata } from "next";
import { HomeJsonLd } from "@/components/seo/json-ld";
import { HomePageClient } from "@/app/home-client";
import {
  buildDefaultDescription,
  buildDefaultTitle,
  SITE_URL,
} from "@/lib/seo/site";

const description = buildDefaultDescription();
const title = buildDefaultTitle();

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title,
    description,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const HOME_FAQS = [
  {
    q: "What are your visiting charges?",
    a: "Our standard visiting and inspection charge is ₹199. This fee is completely waived off if you proceed with the repair service with us.",
  },
  {
    q: "Do you provide a warranty on repairs?",
    a: "Yes, we offer a strict 30-day service warranty on our repairs and up to 90 days of warranty on specific spare parts replaced by our technicians.",
  },
  {
    q: "How long does a repair usually take?",
    a: "Most standard repairs are completed within 1 to 2 hours right at your doorstep. For severe issues requiring specific parts, it may take 24-48 hours.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept Cash, UPI (Google Pay, PhonePe, Paytm), and major Credit/Debit cards after the service is successfully completed.",
  },
];

export default function HomePage() {
  return (
    <>
      <HomeJsonLd faqs={HOME_FAQS} />
      <HomePageClient />
    </>
  );
}
