import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CategoryDetail } from "@/app/categories/[categoryId]/category-detail";
import { resolveCategoryByPath } from "@/lib/catalog/resolve";
import { getDb } from "@/lib/firebase/firestore";
import { hasFirebaseWebConfig } from "@/lib/firebase/client";
import { SITE_NAME, SITE_URL } from "@/lib/seo/site";

type PageProps = {
  params: Promise<{ categoryId: string }>;
};

function categoryName(row: { name?: string; title?: string } | null) {
  return String(row?.name ?? row?.title ?? "Category").trim() || "Category";
}

function categoryDescription(
  row: {
    name?: string;
    title?: string;
    description?: string;
    desc?: string;
  } | null,
) {
  const explicit = String(row?.description ?? row?.desc ?? "").trim();
  if (explicit) return explicit.slice(0, 160);
  const name = categoryName(row);
  return `Explore ${name} services from Repair Series. Book verified technicians for same-day appliance repair and cleaning in Gurugram, Hyderabad & Aligarh.`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoryId } = await params;
  const fallbackTitle = "Category";
  const fallbackDescription =
    "Browse appliance repair and home service categories from Repair Series.";

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
    const row = await resolveCategoryByPath(db, categoryId);
    if (!row) {
      return {
        title: fallbackTitle,
        description: fallbackDescription,
      };
    }
    const name = categoryName(row);
    const description = categoryDescription(row);
    const title = `${name} | ${SITE_NAME}`;
    const path = `/categories/${categoryId}`;
    const image =
      String(
        (row as { icon?: string; image?: string }).icon ??
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

export default async function CategoryDetailPage({ params }: PageProps) {
  const { categoryId } = await params;
  return (
    <Container className="py-12">
      <CategoryDetail categoryIdOrSlug={categoryId} />
    </Container>
  );
}
