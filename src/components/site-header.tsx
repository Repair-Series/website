"use client";

import Link from "next/link";
import { Container } from "@/components/container";
import { HeaderAuth } from "@/components/header-auth";
import { HeaderCartButton } from "@/components/header/header-cart";
import { HeaderLocationDropdown } from "@/components/header/header-location";
import { HeaderSearch } from "@/components/header/header-search";

/**
 * Desktop / laptop site chrome only.
 * Phone widths use MobileAppHome + MobileBottomNav (app-identical UI).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 hidden border-b border-gray-200 bg-white md:block">
      <Container className="flex h-[72px] items-center justify-between gap-3 lg:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-85"
          >
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <img
                src="/web-app-manifest-192x192.png"
                alt="Repair Series"
                className="size-10"
              />
            </div>
            <div className="flex flex-col text-[15px] font-bold leading-[1.1] text-black">
              <span>Repair</span>
              <span>Series</span>
            </div>
          </Link>
        </div>

        <div className="flex flex-1 items-center gap-4 lg:px-6">
          <HeaderLocationDropdown />
          <HeaderSearch />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <HeaderCartButton />
          <HeaderAuth />
        </div>
      </Container>
    </header>
  );
}
