import type { ServiceDoc } from "@/lib/booking/types";

export type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function serviceName(s: ServiceDoc): string {
  return String(s.name ?? s.title ?? "").trim();
}

function categoryName(c: CategoryDoc): string {
  return String(c.name ?? c.title ?? "").trim();
}

export function searchCatalog(
  query: string,
  services: ServiceDoc[],
  categories: CategoryDoc[],
  limit = 8,
): { services: ServiceDoc[]; categories: CategoryDoc[] } {
  const q = norm(query);
  if (!q) {
    return {
      services: services.slice(0, limit),
      categories: categories.slice(0, Math.min(4, limit)),
    };
  }

  const matchedServices = services.filter((s) => {
    const name = norm(serviceName(s));
    return name.includes(q);
  });

  const matchedCategories = categories.filter((c) => {
    const name = norm(categoryName(c));
    return name.includes(q);
  });

  return {
    services: matchedServices.slice(0, limit),
    categories: matchedCategories.slice(0, limit),
  };
}

export function filterServicesByNameKeywords(
  services: ServiceDoc[],
  keywords: string[],
): ServiceDoc[] {
  const lowered = keywords.map(norm);
  return services.filter((s) => {
    const name = norm(serviceName(s));
    return lowered.some((kw) => name.includes(kw));
  });
}

export function filterServicesByAnyKeyword(
  services: ServiceDoc[],
  keywords: string[],
): ServiceDoc[] {
  const lowered = keywords.map(norm);
  return services.filter((s) => {
    const name = norm(serviceName(s));
    return lowered.some((kw) => name.includes(kw));
  });
}
