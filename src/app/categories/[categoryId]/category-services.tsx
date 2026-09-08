"use client";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { RemoteImage as Image } from "@/components/remote-image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ServicePrice } from "@/components/services/service-price";
import { getDb } from "@/lib/firebase/firestore";
import type { ServiceDoc } from "@/lib/booking/types";
import { getServicePath, getBookPath } from "@/lib/catalog/slug";
import { serviceHasVariations } from "@/lib/services/pricing";
import { AlertCircle, ArrowRight, ImageOff, SearchX } from "lucide-react";

function getServiceName(s: ServiceDoc) {
  return s.name ?? s.title ?? "Service";
}

function getServiceImage(s: ServiceDoc) {
  return s.imageUrl ?? s.image ?? null;
}

async function fetchServicesForCategory(categoryId: string) {
  const db = getDb();
  if (!db) {
    throw new Error(
      "Firebase is not configured. Create `.env.local` with NEXT_PUBLIC_FIREBASE_* values.",
    );
  }

  const servicesCol = collection(db, "services");

  // Try common field name: categoryId
  const q1 = query(servicesCol, where("categoryId", "==", categoryId), limit(100));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) return snap1.docs;

  // Fallback field name: category_id (commonly used in mobile apps)
  const q2 = query(servicesCol, where("category_id", "==", categoryId), limit(100));
  const snap2 = await getDocs(q2);
  return snap2.docs;
}

export function CategoryServices({ categoryId }: { categoryId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);

  const stableCategoryId = useMemo(() => categoryId, [categoryId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (mounted) {
        setLoading(true);
        setError(null);
        setServices([]);
      }

      try {
        const docs = await fetchServicesForCategory(stableCategoryId);
        const rows: ServiceDoc[] = docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
        if (!mounted) return;
        setServices(rows);
      } catch (e) {
        if (!mounted) return;
        setError(
          e instanceof Error ? e.message : "Failed to load category services",
        );
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [stableCategoryId]);

  return (
    <section className="mt-12">
      {/* Premium Section Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0a0f1c]">
            Services in this category
          </h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Showing specialized services mapped to this category.
          </p>
        </div>
        <Link 
          href="/services" 
          className="group inline-flex items-center text-sm font-bold text-[#f96316] transition-colors hover:text-[#ea580c]"
        >
          View all services 
          <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* States & Grid */}
      {error ? (
        <div className="flex items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-6 text-red-900 shadow-sm">
          <AlertCircle className="mt-0.5 size-6 shrink-0 text-red-500" />
          <div>
            <h3 className="text-base font-bold">Couldn’t load services</h3>
            <p className="mt-1 text-sm text-red-700/90">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm"
            >
              <div className="aspect-[16/10] w-full animate-pulse bg-gray-200" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="h-6 w-2/3 animate-pulse rounded-md bg-gray-200" />
                  <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100">
            <SearchX className="size-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-[#0a0f1c]">No services found</h3>
          <p className="mt-1 text-sm text-[#64748b]">
            This category currently has no mapped services in Firestore.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const name = getServiceName(s);
            const img = getServiceImage(s);
            const serviceHref = getServicePath(s);

            return (
              <div
                key={s.id}
                className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-400 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
              >
                {/* Image Container */}
                <Link href={serviceHref} className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                  {img ? (
                    <>
                      <Image
                        alt={name}
                        src={img}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-[#94a3b8]">
                      <ImageOff className="mb-2 size-8 opacity-50" />
                      <span className="text-xs font-medium uppercase tracking-wider opacity-70">No Image</span>
                    </div>
                  )}
                </Link>

                {/* Content Container */}
                <div className="flex flex-1 flex-col p-5">
                  <Link href={serviceHref} className="line-clamp-2 text-lg font-bold leading-tight text-[#0a0f1c] transition-colors hover:text-[#f96316]">
                    {name}
                  </Link>
                  <ServicePrice service={s} className="mt-2" />

                  <p className="mt-3 line-clamp-2 flex-1 text-[0.9rem] leading-relaxed text-[#64748b]">
                    {s.description ?? "Expert repair, installation, and maintenance. Book a slot today."}
                  </p>

                  {/* Actions Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                    <Link
                      href={serviceHref}
                      className="text-sm font-semibold text-[#64748b] transition-colors hover:text-[#f96316]"
                    >
                      View Details
                    </Link>
                    <Link
                      href={serviceHasVariations(s) ? serviceHref : getBookPath(s)}
                      className="inline-flex h-9 items-center justify-center rounded-full bg-[#f96316] px-5 text-sm font-bold text-white shadow-[0_4px_10px_rgba(249,99,22,0.2)] transition-all hover:bg-[#ea580c] hover:shadow-[0_4px_15px_rgba(249,99,22,0.3)]"
                    >
                      {serviceHasVariations(s) ? "View Options" : "Book Now"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}