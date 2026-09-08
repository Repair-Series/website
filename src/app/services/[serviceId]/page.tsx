import type { Metadata } from "next";
import { Container } from "@/components/container";
import { ServiceDetail } from "@/app/services/[serviceId]/service-detail";
import { resolveServiceByPath } from "@/lib/catalog/resolve";
import { getDb } from "@/lib/firebase/firestore";
import { hasFirebaseWebConfig } from "@/lib/firebase/client";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";

type PageProps = {
  params: Promise<{ serviceId: string }>;
};

function serviceName(row: { name?: string; title?: string } | null) {
  return String(row?.name ?? row?.title ?? "Service").trim() || "Service";
}

function serviceDescription(
  row: {
    name?: string;
    title?: string;
    description?: string;
    desc?: string;
    shortDescription?: string;
  } | null,
) {
  const explicit = String(
    row?.description ?? row?.desc ?? row?.shortDescription ?? "",
  ).trim();
  if (explicit) return explicit.slice(0, 160);
  const name = serviceName(row);
  return `Book ${name} with Repair Series. Verified technicians, transparent pricing, and same-day service in Gurugram, Hyderabad & Aligarh.`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceId } = await params;
  const fallbackTitle = "Service";
  const fallbackDescription =
    "Book trusted appliance repair and home services with Repair Series.";

  try {
    if (!hasFirebaseWebConfig()) {
      return {
        title: fallbackTitle,
        description: fallbackDescription,
      };
    }
    const db = getDb();
    if (!db) {
      return {
        title: fallbackTitle,
        description: fallbackDescription,
      };
    }
    const row = await resolveServiceByPath(db, serviceId);
    if (!row) {
      return {
        title: fallbackTitle,
        description: fallbackDescription,
      };
    }
    const name = serviceName(row);
    const description = serviceDescription(row);
    const title = `${name} | ${SITE_NAME}`;
    const path = `/services/${serviceId}`;
    const image =
      String(
        (row as { imageUrl?: string; image?: string }).imageUrl ??
          (row as { image?: string }).image ??
          "",
      ).trim() || undefined;

    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}${path}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}${path}`,
        type: "website",
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
    };
  }
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { serviceId } = await params;

  return (
    <Container className="py-12">
      <ServiceDetail serviceIdOrSlug={serviceId} />
    </Container>
  );
}
