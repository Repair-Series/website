import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { Container } from "@/components/container";
import { PageJsonLd } from "@/components/seo/json-ld";
import {
  buildCityLandingCopy,
  buildDefaultDescription,
  buildDefaultTitle,
  cityFromSlug,
  cityServiceTitle,
  citySlug,
  getCityPath,
  SEO_KEYWORDS,
  SERVICE_CITIES,
  SITE_NAME,
  SITE_URL,
  type ServiceCity,
} from "@/lib/seo/site";

type PageProps = {
  params: Promise<{ city: string }>;
};

export function generateStaticParams() {
  return SERVICE_CITIES.map((city) => ({ city: citySlug(city) }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: raw } = await params;
  const city = cityFromSlug(raw);
  if (!city) {
    return {
      title: "City not found",
      description: buildDefaultDescription(),
    };
  }
  const title = buildDefaultTitle(city);
  const description = buildDefaultDescription(city);
  const path = getCityPath(city);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: "website",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function CityJsonLd({ city }: { city: ServiceCity }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: `${SITE_URL}${getCityPath(city)}`,
    description: buildDefaultDescription(city),
    areaServed: { "@type": "City", name: city },
    serviceType: SEO_KEYWORDS,
    priceRange: "₹₹",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function CityLandingPage({ params }: PageProps) {
  const { city: raw } = await params;
  const city = cityFromSlug(raw);
  if (!city) notFound();

  const copy = buildCityLandingCopy(city);
  const path = getCityPath(city);
  const title = buildDefaultTitle(city);
  const description = buildDefaultDescription(city);
  const featured = SEO_KEYWORDS.slice(0, 8);

  return (
    <div className="bg-white font-sans text-[#1e293b]">
      <PageJsonLd title={title} description={description} path={path} />
      <CityJsonLd city={city} />

      <section className="bg-gradient-to-br from-[#f8fafc] to-[#edf2f8] py-16 sm:py-24">
        <Container className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-4 py-2 text-sm font-medium text-[#0a0f1c] shadow-sm">
            <MapPin className="size-4 text-[#f96316]" />
            Serving {city}
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-[#0a0f1c] sm:text-5xl">
            {copy.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#64748b]">
            {copy.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/services"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#0a0f1c] px-7 text-sm font-semibold text-white transition hover:bg-[#162032]"
            >
              Browse services
            </Link>
            <Link
              href="/categories"
              className="inline-flex h-12 items-center justify-center rounded-full border border-gray-300 bg-white px-7 text-sm font-semibold text-[#1e293b] transition hover:bg-gray-50"
            >
              View categories
            </Link>
          </div>
        </Container>
      </section>

      <section className="border-b border-gray-100 py-16">
        <Container>
          <h2 className="text-2xl font-bold text-[#0a0f1c] sm:text-3xl">
            Why book Repair Series in {city}?
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {copy.bullets.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-[#f8fafc] p-5"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#f96316]" />
                <span className="text-sm font-medium text-[#1e293b]">{item}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#0a0f1c] sm:text-3xl">
                Popular services in {city}
              </h2>
              <p className="mt-2 text-[#64748b]">
                Same-day AC, washing machine, RO, electrical &amp; more —
                book online in minutes.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center text-sm font-bold text-[#f96316] hover:underline"
            >
              All services <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((service) => (
              <Link
                key={service}
                href="/services"
                className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-4 transition hover:-translate-y-0.5 hover:border-[#f96316]/30 hover:shadow-md"
              >
                <div className="font-bold text-[#0a0f1c]">
                  {cityServiceTitle(service, city)}
                </div>
                <div className="mt-1 text-xs font-semibold text-[#f96316]">
                  Book now
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[#0a0f1c] py-14">
        <Container className="text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready for doorstep service in {city}?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[#94a3b8]">
            Choose a service, pick a slot, and a verified technician arrives at
            your home.
          </p>
          <Link
            href="/services"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#f96316] px-8 text-sm font-bold text-white transition hover:bg-[#ea580c]"
          >
            Book a technician
          </Link>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {SERVICE_CITIES.filter((c) => c !== city).map((other) => (
              <Link
                key={other}
                href={getCityPath(other)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
              >
                Also in {other}
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
