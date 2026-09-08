import { MetadataRoute } from "next";
import { collection, getDocs } from "firebase/firestore";
import { hasFirebaseWebConfig } from "@/lib/firebase/client";
import { getDb } from "@/lib/firebase/firestore";
import { citySlug, SERVICE_CITIES, SITE_URL } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/about",
    "/contact",
    "/services",
    "/categories",
    "/terms",
    "/privacy-policy",
    "/refund",
    ...SERVICE_CITIES.map((city) => `/cities/${citySlug(city)}`),
  ].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : route.startsWith("/cities/") ? 0.85 : 0.8,
  }));

  try {
    if (!hasFirebaseWebConfig()) return staticRoutes;

    const db = getDb();
    if (!db) return staticRoutes;

    const servicesCol = collection(db, "services");
    const servicesSnapshot = await getDocs(servicesCol);

    const dynamicServices = servicesSnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const slug = data.slug || docSnap.id;

      return {
        url: `${SITE_URL}/services/${slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      };
    });

    const categoriesCol = collection(db, "categories");
    const categoriesSnapshot = await getDocs(categoriesCol);

    const dynamicCategories = categoriesSnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const slug = data.slug || docSnap.id;

      return {
        url: `${SITE_URL}/categories/${slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      };
    });

    return [...staticRoutes, ...dynamicCategories, ...dynamicServices];
  } catch {
    return staticRoutes;
  }
}
