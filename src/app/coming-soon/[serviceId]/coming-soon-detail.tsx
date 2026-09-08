"use client";

import { RemoteImage as Image } from "@/components/remote-image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Container } from "@/components/container";
import { getDb } from "@/lib/firebase/firestore";
import type { ServiceDoc } from "@/lib/booking/types";
import { PromoBannerSection } from "@/components/home/promo-banner";
import { bannerSectionsForComingSoon } from "@/lib/banners/sections";

export function ComingSoonDetail({ serviceIdOrSlug }: { serviceIdOrSlug: string }) {
  const [service, setService] = useState<ServiceDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const db = getDb();
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const direct = await getDoc(doc(db, "services", serviceIdOrSlug));
        if (direct.exists()) {
          if (mounted) {
            setService({ id: direct.id, ...(direct.data() as object) } as ServiceDoc);
          }
          return;
        }
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        const bySlug = await getDocs(
          query(collection(db, "services"), where("slug", "==", serviceIdOrSlug)),
        );
        if (!bySlug.empty && mounted) {
          const d = bySlug.docs[0];
          setService({ id: d.id, ...(d.data() as object) } as ServiceDoc);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [serviceIdOrSlug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-20">
        <div className="h-96 animate-pulse rounded-[28px] bg-muted/40" />
      </div>
    );
  }

  const img = service?.homeImage || service?.imageUrl || service?.image;
  const name = service?.name ?? service?.title ?? "Service";

  return (
    <div className="bg-gradient-to-b from-[#fff7f0] to-white pb-20 pt-8">
      <Container className="max-w-2xl">
        <PromoBannerSection section={bannerSectionsForComingSoon(service)} />
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-semibold text-[#64748b] hover:text-[#f96316]"
        >
          <ArrowLeft className="mr-2 size-4" /> Back to Home
        </Link>

        <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
          <div className="relative aspect-[16/10] bg-gray-100">
            {img ? (
              <Image src={img} alt={name} fill className="object-cover" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-[#94a3b8]">
                Coming soon
              </div>
            )}
            <span className="absolute right-4 top-4 rounded-full bg-[#f96316] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              Coming Soon
            </span>
          </div>

          <div className="px-6 py-10 text-center sm:px-10">
            <h1 className="text-2xl font-bold text-[#0a0f1c] sm:text-3xl">{name}</h1>

            <div className="mx-auto mt-8 flex size-24 items-center justify-center rounded-full bg-orange-50">
              <Clock className="size-12 text-[#f96316]" strokeWidth={1.5} />
            </div>

            <p className="mt-6 text-lg font-semibold text-[#0a0f1c]">Coming Soon</p>
            <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
              This service will be available soon.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              We&apos;re working hard to launch this service.
              <br />
              Stay tuned for future updates.
            </p>

            <Link
              href="/"
              className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-[#f96316] px-8 text-sm font-bold text-white shadow-lg transition hover:bg-[#e55510]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
