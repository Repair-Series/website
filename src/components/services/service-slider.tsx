"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { AddToCartButton } from "@/components/services/add-to-cart-button";
import { ServicePrice } from "@/components/services/service-price";
import type { ServiceDoc } from "@/lib/booking/types";
import { getBookPath, getServicePath } from "@/lib/catalog/slug";
import { serviceHasVariations } from "@/lib/services/pricing";
import { getServiceImage, getServiceName } from "@/lib/services/helpers";

type ServiceSliderProps = {
  services: ServiceDoc[];
};

export function ServiceSlider({ services }: ServiceSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (services.length === 0) return null;

  return (
    <div className="group/slider relative">
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="absolute -left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50 lg:flex"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="absolute -right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50 lg:flex"
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {services.map((s) => {
          const name = getServiceName(s);
          const img = getServiceImage(s);
          const href = serviceHasVariations(s) ? getServicePath(s) : getBookPath(s);

          return (
            <div
              key={s.id}
              className="w-[min(280px,78vw)] shrink-0 overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
            >
              <Link href={href} className="block">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {img ? (
                    <img
                      src={img}
                      alt={name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Wrench className="size-12 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <Link href={href}>
                  <h3 className="line-clamp-2 font-bold text-[#0a0f1c] transition-colors hover:text-[#f96316]">
                    {name}
                  </h3>
                </Link>
                <ServicePrice service={s} className="mt-1.5" />
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={href}
                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#f96316] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#ea580c]"
                  >
                    Book Now
                  </Link>
                  <AddToCartButton service={s} size="sm" className="w-full" />
                  <Link
                    href={getServicePath(s)}
                    className="text-center text-xs font-semibold text-[#64748b] hover:text-[#f96316]"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
