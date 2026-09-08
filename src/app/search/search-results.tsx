"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { Search } from "lucide-react";
import { Container } from "@/components/container";
import { ServicePrice } from "@/components/services/service-price";
import { useCatalog } from "@/context/catalog-context";
import { getCategoryPath, getServicePath } from "@/lib/catalog/slug";
import { searchCatalog } from "@/lib/search/catalog-search";
import { SectionPromoBanner } from "@/components/home/promo-banner";

export default function SearchResultsClient({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = use(searchParams);
  const q = String(rawQ ?? "").trim();
  const { services, categories, loading } = useCatalog();

  const results = useMemo(
    () => searchCatalog(q, services, categories, 50),
    [q, services, categories],
  );

  const empty = !loading && q && results.services.length === 0 && results.categories.length === 0;

  return (
    <div className="animate-in fade-in duration-500 bg-[#F8F6F4] py-4 md:bg-transparent md:py-10">
      <Container>
        <div className="-mx-4 mb-2 md:mx-0">
          <SectionPromoBanner section="search" />
        </div>
        <div className="flex items-center gap-3">
          <Search className="size-6 text-[#f96316]" />
          <div>
            <h1 className="text-2xl font-bold text-[#0a0f1c]">
              {q ? `Results for "${q}"` : "Search Services"}
            </h1>
            <p className="text-sm text-[#64748b]">
              AC repair, cleaning, electrician & more across Gurugram, Hyderabad & Aligarh.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="size-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f96316]" />
          </div>
        ) : empty ? (
          <div className="mt-12 rounded-[20px] border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
            <p className="text-lg font-bold text-[#0a0f1c]">No services found</p>
            <p className="mt-1 text-sm text-[#64748b]">Try a different keyword or browse all services.</p>
            <Link href="/services" className="mt-6 inline-flex text-sm font-bold text-[#f96316] hover:underline">
              View all services
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {results.services.length > 0 ? (
              <section>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#64748b]">Services</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.services.map((s) => (
                    <Link
                      key={s.id}
                      href={getServicePath(s)}
                      className="rounded-[16px] border border-gray-100 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="font-bold text-[#0a0f1c]">{s.name ?? s.title}</div>
                      <ServicePrice service={s} className="mt-1" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            {results.categories.length > 0 ? (
              <section>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#64748b]">Categories</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {results.categories.map((c) => (
                    <Link
                      key={c.id}
                      href={getCategoryPath(c)}
                      className="rounded-xl border border-gray-100 bg-white px-4 py-3 font-semibold text-[#0a0f1c] transition hover:border-[#f96316]/30"
                    >
                      {c.name ?? c.title}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </Container>
    </div>
  );
}
