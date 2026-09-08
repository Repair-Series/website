import {
  buildDefaultDescription,
  buildDefaultTitle,
  SEO_KEYWORDS,
  SERVICE_CITIES,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";

type FaqItem = { q: string; a: string };

const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "What are your visiting charges?",
    a: "Our standard visiting and inspection charge is ₹199. This fee is waived if you proceed with the repair.",
  },
  {
    q: "Do you provide a warranty on repairs?",
    a: "Yes — 30-day service warranty on repairs and up to 90 days on specific spare parts.",
  },
  {
    q: "Which cities do you serve?",
    a: "We serve Gurugram, Hyderabad, and Aligarh with same-day doorstep appliance repair and cleaning.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Cash, UPI, and major credit/debit cards after service completion.",
  },
];

export function HomeJsonLd({ faqs = DEFAULT_FAQS }: { faqs?: FaqItem[] }) {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: SITE_URL,
    image: `${SITE_URL}/web-app-manifest-512x512.png`,
    description: buildDefaultDescription(),
    areaServed: SERVICE_CITIES.map((city) => ({
      "@type": "City",
      name: city,
    })),
    serviceType: SEO_KEYWORDS,
    priceRange: "₹₹",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/web-app-manifest-192x192.png`,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Services",
        item: `${SITE_URL}/services`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const serviceOffers = SEO_KEYWORDS.slice(0, 6).flatMap((keyword) =>
    SERVICE_CITIES.map((city) => ({
      "@type": "Service",
      name: `${keyword} in ${city}`,
      provider: { "@type": "LocalBusiness", name: SITE_NAME },
      areaServed: city,
      description: `Professional ${keyword.toLowerCase()} in ${city} by verified technicians.`,
    })),
  );

  const serviceSchema = {
    "@context": "https://schema.org",
    "@graph": serviceOffers,
  };

  const blocks = [localBusiness, organization, website, breadcrumb, faqSchema, serviceSchema];

  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}

export function PageJsonLd({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export { buildDefaultTitle, buildDefaultDescription };
